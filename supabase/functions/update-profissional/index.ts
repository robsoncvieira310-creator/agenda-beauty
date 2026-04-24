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
    const { 
      profissional_id, 
      profile_id,
      especialidade,
      status,
      nome,
      email,
      telefone
    } = await req.json()

    if (!profissional_id || typeof profissional_id !== "string") {
      return new Response(
        JSON.stringify({ error: "profissional_id inválido" }),
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
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: corsHeaders }
      )
    }

    // ✅ PROFILE do usuário logado
    const { data: userProfile } = await admin
      .from("profiles")
      .select("role, empresa_id")
      .eq("id", user.id)
      .single()

    // ✅ PERMISSION (admin ou próprio profissional)
    const isAdmin = userProfile?.role === "admin" || userProfile?.role === "adm_empresa"
    const isSelf = user.id === profile_id

    if (!isAdmin && !isSelf) {
      return new Response(
        JSON.stringify({ error: "Permissão negada" }),
        { status: 403, headers: corsHeaders }
      )
    }

    console.log('Updating profissional:', profissional_id, 'profile:', profile_id)

    // 🔄 ATUALIZAR TABELA PROFISSIONAIS
    let updatedProfissional = null
    const dadosProfissional: any = {}
    if (especialidade !== undefined) dadosProfissional.especialidade = especialidade
    if (status !== undefined) dadosProfissional.status = status

    if (Object.keys(dadosProfissional).length > 0) {
      console.log('Updating profissionais:', profissional_id, 'with:', dadosProfissional)
      const { data, error } = await admin
        .from("profissionais")
        .update(dadosProfissional)
        .eq("id", profissional_id)
        .select("*")
        .single()

      if (error) {
        console.error('Error updating profissional:', error)
        throw error
      }
      updatedProfissional = data
      console.log('Profissional updated successfully:', updatedProfissional)
    } else {
      // Buscar profissional existente para retorno
      const { data, error } = await admin
        .from("profissionais")
        .select("*")
        .eq("id", profissional_id)
        .single()
      if (error) {
        console.error('Error fetching profissional:', error)
        throw error
      }
      updatedProfissional = data
      console.log('Fetched existing profissional:', updatedProfissional)
    }

    // 🔄 ATUALIZAR TABELA PROFILES
    let updatedProfile = null
    const dadosProfile: any = {}
    if (nome !== undefined) dadosProfile.nome = nome
    if (email !== undefined) dadosProfile.email = email
    if (telefone !== undefined) dadosProfile.telefone = telefone

    if (Object.keys(dadosProfile).length > 0 && profile_id) {
      console.log('Updating profile:', profile_id, 'with:', dadosProfile)
      
      // Buscar email atual para comparar
      const { data: currentProfile, error: fetchError } = await admin
        .from("profiles")
        .select("email")
        .eq("id", profile_id)
        .single()
      
      if (fetchError) {
        console.error('Error fetching current profile:', fetchError)
        throw fetchError
      }

      const { error: profileUpdateError } = await admin
        .from("profiles")
        .update(dadosProfile)
        .eq("id", profile_id)

      if (profileUpdateError) {
        console.error('Error updating profile:', profileUpdateError)
        throw profileUpdateError
      }

      // 🔄 ATUALIZAR EMAIL NO AUTH.USERS (se email mudou)
      if (email !== undefined && email.trim() !== '' && currentProfile?.email !== email.trim()) {
        console.log('Updating email in auth.users for user:', profile_id)
        const { error: authUpdateError } = await admin.auth.admin.updateUserById(
          profile_id,
          { email: email.trim() }
        )

        if (authUpdateError) {
          console.error('Error updating auth user email:', authUpdateError)
          throw authUpdateError
        }
        console.log('Auth user email updated successfully')
      }

      // Buscar profile atualizado
      const { data: refreshedProfile, error: profileRefreshError } = await admin
        .from("profiles")
        .select("*")
        .eq("id", profile_id)
        .single()

      if (profileRefreshError) {
        console.error('Error refreshing profile:', profileRefreshError)
      } else {
        updatedProfile = refreshedProfile
        console.log('Profile updated successfully:', updatedProfile)
      }
    }

    // 📝 LOG DE RETORNO
    console.log('=== RESPONSE ===')
    console.log('updatedProfissional:', updatedProfissional)
    console.log('updatedProfile:', updatedProfile)
    console.log('===============')

    return new Response(
      JSON.stringify({ 
        success: true, 
        profissional: updatedProfissional,
        profile: updatedProfile
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (err: any) {
    console.error("❌ ERRO:", err)

    return new Response(
      JSON.stringify({
        error: "Erro ao atualizar profissional",
        details: err.message,
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
