// ========================================
// CREATE EMPRESA - VERSÃO CONTROLADA
// ========================================
// Segue exatamente o mesmo padrão de create-profissional
// com validação rigorosa de admin no backend

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader =
      req.headers.get("authorization") ||
      req.headers.get("Authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Sem token" }),
        { status: 401, headers: corsHeaders }
      )
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // =============================
    // 1. VALIDAR USER AUTENTICADO
    // =============================
    const { data: { user } } = await supabaseUser.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: corsHeaders }
      )
    }

    // =============================
    // 2. VALIDAR ADMIN (BACKEND AUTHORITY)
    // =============================
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Acesso negado" }),
        { status: 403, headers: corsHeaders }
      )
    }

    // =============================
    // 3. INPUT VALIDATION
    // =============================
    const { nome, email, password } = await req.json()

    if (!nome || !email || !password) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: nome, email, password" }),
        { status: 400, headers: corsHeaders }
      )
    }

    // =============================
    // 4. CRIAR EMPRESA
    // =============================
    const { data: empresaData, error: empresaError } = await supabaseAdmin
      .from("empresas")
      .insert({ nome })
      .select("id")
      .single()

    if (empresaError) {
      console.error("[CREATE EMPRESA] Erro ao criar empresa:", empresaError)
      return new Response(
        JSON.stringify({ error: "Erro ao criar empresa", details: empresaError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    const empresaId = empresaData.id
    console.log("[CREATE EMPRESA] Empresa criada:", empresaId)

    // =============================
    // 5. CRIAR USUÁRIO NO SUPABASE AUTH
    // =============================
    const { data: userData, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: "adm_empresa",
          empresa_id: empresaId,
        },
      })

    if (createUserError) {
      // Rollback: deletar empresa criada
      await supabaseAdmin.from("empresas").delete().eq("id", empresaId)
      console.error("[CREATE EMPRESA] Erro ao criar usuário:", createUserError)
      return new Response(
        JSON.stringify({ error: createUserError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    const userId = userData.user.id
    console.log("[CREATE EMPRESA] Usuário criado:", userId)

    // =============================
    // 6. VERIFICAR/CRIAR PROFILE
    // O trigger handle_new_user cria automaticamente, mas vamos garantir
    // =============================
    
    // Aguardar um momento para o trigger executar
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Verificar se profile já existe (criado pelo trigger)
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from("profiles")
      .select("id, empresa_id, role")
      .eq("id", userId)
      .single()
    
    if (!existingProfile) {
      console.log("[CREATE EMPRESA] Profile não encontrado, criando manualmente...")
      
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: userId,
          role: "adm_empresa",
          empresa_id: empresaId,
        })

      if (profileError) {
        // Rollback: deletar usuário e empresa
        await supabaseAdmin.auth.admin.deleteUser(userId)
        await supabaseAdmin.from("empresas").delete().eq("id", empresaId)
        console.error("[CREATE EMPRESA] Erro ao criar profile:", profileError)
        return new Response(
          JSON.stringify({ error: "Erro ao criar profile", details: profileError.message }),
          { status: 500, headers: corsHeaders }
        )
      }
      
      console.log("[CREATE EMPRESA] Profile criado manualmente:", userId)
    } else {
      console.log("[CREATE EMPRESA] Profile já existe (trigger funcionou):", userId)
      
      // Verificar se o trigger preencheu corretamente
      if (!existingProfile.empresa_id) {
        console.log("[CREATE EMPRESA] Atualizando empresa_id no profile existente...")
        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({ empresa_id: empresaId })
          .eq("id", userId)
        
        if (updateError) {
          console.error("[CREATE EMPRESA] Erro ao atualizar empresa_id:", updateError)
        }
      }
    }

    // =============================
    // 7. VALIDAR CONSISTÊNCIA
    // =============================
    const { data: profileCheck, error: checkError2 } = await supabaseAdmin
      .from("profiles")
      .select("id, empresa_id, role")
      .eq("id", userId)
      .single()

    if (checkError2 || !profileCheck) {
      console.error("[CREATE EMPRESA] Falha na validação de consistência:", checkError)
      // Não fazer rollback aqui - dados já estão criados, apenas logar
    } else if (profileCheck.empresa_id !== empresaId) {
      console.error("[CREATE EMPRESA] INCONSISTÊNCIA: empresa_id não bate", {
        esperado: empresaId,
        atual: profileCheck.empresa_id,
      })
    }

    // =============================
    // 8. AUDIT LOG
    // =============================
    const { error: auditError } = await supabaseAdmin
      .from("audit_logs")
      .insert({
        table_name: "empresas",
        record_id: empresaId,
        action: "CREATE",
        user_id: user.id,
      })

    if (auditError) {
      console.log("[CREATE EMPRESA] ⚠️ audit log:", auditError.message)
    }

    // =============================
    // 9. SUCESSO
    // =============================
    return new Response(
      JSON.stringify({
        success: true,
        empresa_id: empresaId,
        user_id: userId,
        message: "Empresa criada com sucesso",
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )

  } catch (err: any) {
    console.error("[CREATE EMPRESA] ❌ ERRO:", err)
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Erro desconhecido",
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
