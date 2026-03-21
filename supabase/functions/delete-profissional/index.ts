import { createClient } from "@supabase/supabase-js"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

// 🔐 ENV
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabaseAnonKey = Deno.env.get('ANON_KEY')!

Deno.serve(async (req) => {
  console.log('🔥 DELETE PROFISSIONAL INICIADA')

  // =============================
  // 🌐 CORS
  // =============================
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // =============================
  // 📥 INPUT
  // =============================
  try {
    const { profile_id } = await req.json()

    if (!profile_id) {
      return new Response(JSON.stringify({ error: 'profile_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('📥 PROFILE_ID:', profile_id)

    // =============================
    // 🔐 AUTH HEADER
    // =============================
    const authHeader =
      req.headers.get('authorization') ||
      req.headers.get('Authorization')

    console.log('🔐 AUTH HEADER:', authHeader)

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Sem token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // =============================
    // 👤 CLIENT USER (JWT)
    // =============================
    const supabaseUser = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    )

    // =============================
    // 👑 CLIENT ADMIN
    // =============================
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey
    )

    // =============================
    // ✅ VALIDAR USUÁRIO
    // =============================
    console.log('USER CLIENT OK')
    const {
      data: { user },
      error: userError
    } = await supabaseUser.auth.getUser()

    console.log('👤 USER:', user)
    console.log('❌ USER ERROR:', userError)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // =============================
    // 🔒 VALIDAR ADMIN
    // =============================
    console.log('ADMIN CLIENT OK')
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    console.log('🔐 ROLE:', profile)
    console.log('❌ PROFILE ERROR:', profileError)

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Apenas admin pode deletar profissionais' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // =============================
    // 🔍 VERIFICAR SE PROFISSIONAL EXISTE
    // =============================
    console.log('🔍 VERIFICANDO PROFISSIONAL...')
    const { data: profissional, error: profissionalError } = await supabaseAdmin
      .from('profissionais')
      .select('profile_id')
      .eq('profile_id', profile_id)
      .single()

    if (profissionalError || !profissional) {
      return new Response(JSON.stringify({ error: 'Profissional não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('✅ PROFISSIONAL ENCONTRADO:', profissional)

    // =============================
    // 🗑️ DELETE USER (CASCADE)
    // =============================
    console.log('🗑️ DELETANDO USUÁRIO DO AUTH...')
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(
      profile_id
    )

    if (deleteUserError) {
      console.error('❌ ERRO DELETE USER:', deleteUserError)
      return new Response(JSON.stringify({ 
        error: 'Erro ao deletar usuário do auth',
        details: deleteUserError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('✅ USUÁRIO DELETADO DO AUTH')

    // =============================
    // ✅ SUCESSO
    // =============================
    console.log('🎉 PROFISSIONAL DELETADO COM SUCESSO')

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Profissional deletado com sucesso',
      deleted_profile_id: profile_id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('🔥 ERRO GERAL:', err)

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
