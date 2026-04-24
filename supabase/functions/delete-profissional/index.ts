import { createClient } from "@supabase/supabase-js"

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
    const { profile_id } = await req.json()

    if (!profile_id || typeof profile_id !== "string") {
      return new Response(
        JSON.stringify({ error: "profile_id inválido" }),
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

    // ✅ ADMIN
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || (profile.role !== "admin" && profile.role !== "adm_empresa")) {
      return new Response(
        JSON.stringify({ error: "Apenas admin ou admin de empresa" }),
        { status: 403, headers: corsHeaders }
      )
    }

    // 🔍 PROFISSIONAL
    const { data: profissional } = await admin
      .from("profissionais")
      .select("id")
      .eq("profile_id", profile_id)
      .single()

    if (!profissional) {
      return new Response(
        JSON.stringify({ error: "Profissional não encontrado" }),
        { status: 404, headers: corsHeaders }
      )
    }

    const profissionalId = profissional.id

    // 🗑️ RELACIONADOS
    await admin
      .from("agendamentos")
      .delete()
      .eq("profissional_id", profissionalId)

    const { error: bloqueiosError } = await admin
      .from("bloqueios")
      .delete()
      .eq("profissional_id", profissionalId)

    if (bloqueiosError) {
      console.log("⚠️ bloqueios:", bloqueiosError.message)
    }

    // 🗑️ PROFISSIONAL
    const { error: errProf } = await admin
      .from("profissionais")
      .delete()
      .eq("profile_id", profile_id)

    if (errProf) throw errProf

    // 🗑️ PROFILE
    const { error: errProfile } = await admin
      .from("profiles")
      .delete()
      .eq("id", profile_id)

    if (errProfile) throw errProfile

    // 🗑️ AUTH
    const { error: errAuth } =
      await admin.auth.admin.deleteUser(profile_id)

    if (errAuth) throw errAuth

    // 📋 AUDITORIA
    const { error: auditError } = await admin
      .from("audit_logs")
      .insert({
        table_name: "profissionais",
        record_id: profile_id,
        action: "DELETE",
        user_id: user.id,
      })

    if (auditError) {
      console.log("⚠️ audit:", auditError.message)
    }

    return new Response(
      JSON.stringify({ success: true }),
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