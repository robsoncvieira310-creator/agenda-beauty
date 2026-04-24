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
    const { empresa_id, nome, email } = await req.json()

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

    // 🔄 ATUALIZAR EMPRESA (sempre que nome for fornecido)
    let updatedEmpresa = empresa
    if (nome !== undefined && nome.trim() !== '') {
      console.log('Updating empresa:', empresa_id, 'nome:', nome)
      
      const { error: updateError } = await admin
        .from("empresas")
        .update({ nome: nome.trim() })
        .eq("id", empresa_id)

      if (updateError) {
        console.error('Error updating empresa:', updateError)
        throw updateError
      }
      
      // 🔄 Buscar dados atualizados
      const { data: refreshedEmpresa, error: refreshError } = await admin
        .from("empresas")
        .select("*")
        .eq("id", empresa_id)
        .single()
        
      if (refreshError) {
        console.error('Error refreshing empresa:', refreshError)
        throw refreshError
      }
      
      updatedEmpresa = refreshedEmpresa || empresa
      console.log('Empresa updated successfully:', updatedEmpresa)
    }

    // 🔄 ATUALIZAR EMAIL DO ADMIN (profile adm_empresa)
    let updatedProfile = null
    if (email !== undefined && email.trim() !== '') {
      console.log('Looking for admin profile for empresa:', empresa_id)
      
      const { data: adminProfiles, error: findError } = await admin
        .from("profiles")
        .select("id, email, nome")
        .eq("empresa_id", empresa_id)
        .eq("role", "adm_empresa")

      if (findError) {
        console.log('Error finding admin profiles:', findError.message)
      } else if (adminProfiles && adminProfiles.length > 0) {
        const adminProfile = adminProfiles[0]
        console.log('Found admin profile:', adminProfile.id, 'total found:', adminProfiles.length)
        
        if (adminProfile.email !== email.trim()) {
          const { error: profileUpdateError } = await admin
            .from("profiles")
            .update({ email: email.trim() })
            .eq("id", adminProfile.id)

          if (profileUpdateError) {
            console.error('Error updating profile:', profileUpdateError)
            throw profileUpdateError
          }

          // 🔄 ATUALIZAR EMAIL NO AUTH.USERS (via Admin API)
          console.log('Updating email in auth.users for user:', adminProfile.id)
          const { error: authUpdateError } = await admin.auth.admin.updateUserById(
            adminProfile.id,
            { email: email.trim() }
          )

          if (authUpdateError) {
            console.error('Error updating auth user email:', authUpdateError)
            throw authUpdateError
          }
          console.log('Auth user email updated successfully')

          // 🔄 Buscar profile atualizado
          const { data: refreshedProfile, error: profileRefreshError } = await admin
            .from("profiles")
            .select("*")
            .eq("id", adminProfile.id)
            .single()
            
          if (profileRefreshError) {
            console.error('Error refreshing profile:', profileRefreshError)
          } else {
            updatedProfile = refreshedProfile
            console.log('Profile updated successfully:', updatedProfile)
          }
        } else {
          updatedProfile = adminProfile
          console.log('Email unchanged, skipping profile update')
        }
      } else {
        console.log('No admin profiles found for empresa:', empresa_id, 'result:', adminProfiles)
      }
    }

    // 📋 AUDITORIA
    const { error: auditError } = await admin
      .from("audit_logs")
      .insert({
        table_name: "empresas",
        record_id: empresa_id,
        action: "UPDATE",
        user_id: user.id,
        details: { 
          nome_antigo: empresa.nome,
          nome_novo: nome,
          email_novo: email
        }
      })

    if (auditError) {
      console.log("⚠️ audit:", auditError.message)
    }

    // 📝 LOG DE RETORNO
    console.log('=== RESPONSE ===')
    console.log('updatedEmpresa:', updatedEmpresa)
    console.log('updatedProfile:', updatedProfile)
    console.log('===============')

    return new Response(
      JSON.stringify({ 
        success: true, 
        empresa: updatedEmpresa,
        profile: updatedProfile
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (err: any) {
    console.error("❌ ERRO:", err)

    return new Response(
      JSON.stringify({
        error: "Erro ao atualizar empresa",
        details: err.message,
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
