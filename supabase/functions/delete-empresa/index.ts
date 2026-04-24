import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { empresa_id } = await req.json()

    if (!empresa_id || typeof empresa_id !== "string") {
      return new Response(
        JSON.stringify({ error: "empresa_id inválido" }),
        { status: 400, headers: corsHeaders }
      )
    }

    const authHeader =
      req.headers.get("Authorization") ||
      req.headers.get("authorization")

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: corsHeaders }
      )
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const admin = createClient(supabaseUrl, serviceKey)

    // ✅ USER
    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: corsHeaders }
      )
    }

    // ✅ ADMIN CHECK
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Apenas admin" }),
        { status: 403, headers: corsHeaders }
      )
    }

    // 🔍 VERIFICAR EMPRESA EXISTE
    const { data: empresa } = await admin
      .from("empresas")
      .select("id, nome")
      .eq("id", empresa_id)
      .single()

    if (!empresa) {
      return new Response(
        JSON.stringify({ error: "Empresa não encontrada" }),
        { status: 404, headers: corsHeaders }
      )
    }

    // 🗑️ PASSO 1: Buscar todos os profissionais da empresa
    const { data: profissionais } = await admin
      .from("profissionais")
      .select("id")
      .eq("empresa_id", empresa_id)

    const profissionalIds = profissionais?.map(p => p.id) || []

    // 🗑️ PASSO 2: Deletar agendamentos dos profissionais
    if (profissionalIds.length > 0) {
      await admin
        .from("agendamentos")
        .delete()
        .in("profissional_id", profissionalIds)
    }

    // 🗑️ PASSO 3: Deletar bloqueios dos profissionais
    if (profissionalIds.length > 0) {
      const { error: bloqueiosError } = await admin
        .from("bloqueios")
        .delete()
        .in("profissional_id", profissionalIds)

      if (bloqueiosError) {
        console.log("⚠️ bloqueios:", bloqueiosError.message)
      }
    }

    // 🗑️ PASSO 4: Deletar profissional_servicos
    if (profissionalIds.length > 0) {
      await admin
        .from("profissional_servicos")
        .delete()
        .in("profissional_id", profissionalIds)
    }

    // 🗑️ PASSO 5: Deletar profissionais
    await admin
      .from("profissionais")
      .delete()
      .eq("empresa_id", empresa_id)

    // 🗑️ PASSO 6: Buscar todos os clientes da empresa
    const { data: clientes } = await admin
      .from("clientes")
      .select("id")
      .eq("empresa_id", empresa_id)

    const clienteIds = clientes?.map(c => c.id) || []

    // 🗑️ PASSO 7: Deletar anamnese_clientes
    if (clienteIds.length > 0) {
      await admin
        .from("anamnese_clientes")
        .delete()
        .in("cliente_id", clienteIds)
    }

    // 🗑️ PASSO 8: Deletar clientes
    await admin
      .from("clientes")
      .delete()
      .eq("empresa_id", empresa_id)

    // 🗑️ PASSO 9: Buscar profiles para deletar auth.users depois
    const { data: profiles } = await admin
      .from("profiles")
      .select("id")
      .eq("empresa_id", empresa_id)

    const profileIds = profiles?.map(p => p.id) || []

    // 🗑️ PASSO 10: Deletar servicos da empresa
    await admin
      .from("servicos")
      .delete()
      .eq("empresa_id", empresa_id)

    // 🗑️ PASSO 11: Deletar profiles
    await admin
      .from("profiles")
      .delete()
      .eq("empresa_id", empresa_id)

    // 🗑️ PASSO 12: Deletar auth.users
    for (const profileId of profileIds) {
      try {
        await admin.auth.admin.deleteUser(profileId)
      } catch (e: any) {
        console.log("⚠️ auth delete:", e.message)
      }
    }

    // 🗑️ PASSO 13: Deletar empresa
    const { error: errEmpresa } = await admin
      .from("empresas")
      .delete()
      .eq("id", empresa_id)

    if (errEmpresa) throw errEmpresa

    // 📋 AUDITORIA
    const { error: auditError } = await admin
      .from("audit_logs")
      .insert({
        table_name: "empresas",
        record_id: empresa_id,
        action: "DELETE",
        user_id: user.id,
        details: { nome: empresa.nome }
      })

    if (auditError) {
      console.log("⚠️ audit:", auditError.message)
    }

    return new Response(
      JSON.stringify({ success: true, deleted: empresa_id }),
      { status: 200, headers: corsHeaders }
    )

  } catch (err: any) {
    console.error("❌ ERRO:", err)

    return new Response(
      JSON.stringify({
        error: "Erro ao deletar empresa",
        details: err.message,
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
