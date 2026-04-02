import { createClient } from "@supabase/supabase-js"

// ========================================
// 🌐 CORS
// ========================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

// ========================================
// 🔐 ENV
// ========================================
const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!

// ========================================
// 🚀 HANDLER
// ========================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // ========================================
    // 📥 INPUT
    // ========================================
    const { profile_id } = await req.json()

    if (!profile_id || typeof profile_id !== "string") {
      return new Response(
        JSON.stringify({
          error: "profile_id deve ser um UUID válido (string)",
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // ========================================
    // 🔐 AUTH HEADER
    // ========================================
    const authHeader =
      req.headers.get("Authorization") ||
      req.headers.get("authorization")

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Token ausente ou inválido" }),
        { status: 401, headers: corsHeaders }
      )
    }

    // ========================================
    // 👤 CLIENT USER (JWT)
    // ========================================
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // ========================================
    // 👑 CLIENT ADMIN (SERVICE ROLE)
    // ========================================
    const admin = createClient(supabaseUrl, serviceKey)

    // ========================================
    // ✅ VALIDAR USUÁRIO
    // ========================================
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

    // ========================================
    // 🔒 VALIDAR ADMIN
    // ========================================
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profileError || !profile || profile.role !== "admin") {
      return new Response(
        JSON.stringify({
          error: "Apenas administradores podem deletar",
        }),
        { status: 403, headers: corsHeaders }
      )
    }

    // ========================================
    // 🔍 BUSCAR PROFISSIONAL
    // ========================================
    const { data: profissional, error: profError } = await admin
      .from("profissionais")
      .select("id")
      .eq("profile_id", profile_id)
      .single()

    if (profError || !profissional) {
      return new Response(
        JSON.stringify({ error: "Profissional não encontrado" }),
        { status: 404, headers: corsHeaders }
      )
    }

    const profissionalId = profissional.id // INTEGER

    // ========================================
    // 🗑️ 1. DELETAR RELACIONADOS (INTEGER)
    // ========================================
    await admin
      .from("agendamentos")
      .delete()
      .eq("profissional_id", profissionalId)

    await admin
      .from("bloqueios")
      .delete()
      .eq("profissional_id", profissionalId)
      .catch(() => null) // não quebra se não existir

    // ========================================
    // 🗑️ 2. DELETAR PROFISSIONAL
    // ========================================
    const { error: deleteProfError } = await admin
      .from("profissionais")
      .delete()
      .eq("profile_id", profile_id)

    if (deleteProfError) throw deleteProfError

    // ========================================
    // 🗑️ 3. DELETAR PROFILE
    // ========================================
    const { error: deleteProfileError } = await admin
      .from("profiles")
      .delete()
      .eq("id", profile_id)

    if (deleteProfileError) throw deleteProfileError

    // ========================================
    // 🗑️ 4. DELETAR AUTH USER
    // ========================================
    const { error: deleteAuthError } =
      await admin.auth.admin.deleteUser(profile_id)

    if (deleteAuthError) throw deleteAuthError

    // ========================================
    // 📋 5. AUDITORIA (UUID CORRETO)
    // ========================================
    await admin.from("audit_logs").insert({
      table_name: "profissionais",
      record_id: profile_id, // ✅ UUID
      action: "DELETE",
      user_id: user.id, // ✅ UUID
      created_at: new Date().toISOString(),
    })

    // ========================================
    // ✅ SUCESSO
    // ========================================
    return new Response(
      JSON.stringify({
        success: true,
        message: "Profissional deletado com sucesso",
      }),
      { status: 200, headers: corsHeaders }
    )
  } catch (err: any) {
    console.error("❌ ERRO:", err)

    return new Response(
      JSON.stringify({
        error: "Erro ao deletar profissional",
        details: err.message,
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})