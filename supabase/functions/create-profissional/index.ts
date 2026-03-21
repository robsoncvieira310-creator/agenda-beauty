import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

// 🔐 ENV
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabaseAnonKey = Deno.env.get('ANON_KEY')! // ⚠️ nome correto da secret

Deno.serve(async (req) => {
  console.log('🔥 FUNÇÃO INICIADA')

  // =============================
  // 🌐 CORS
  // =============================
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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
      return new Response(JSON.stringify({ error: 'Apenas admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // =============================
    // 📥 INPUT
    // =============================
    const { nome, email, password, telefone } = await req.json()

    if (!nome || !email || !password || !telefone) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('📥 INPUT:', { nome, email, telefone })

    // =============================
    // 🚫 VERIFICAR EMAIL DUPLICADO
    // =============================
    const { data: existingEmail } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingEmail) {
      console.log('⚠️ Email já existe')
      return new Response(JSON.stringify({ error: 'Email já cadastrado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // =============================
    // 1️⃣ CRIAR USER
    // =============================
    console.log('👤 Criando usuário...')

    const { data: userData, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      })

    if (createUserError) {
      console.error('❌ ERRO CREATE USER:', createUserError)
      return new Response(JSON.stringify({ error: createUserError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userId = userData.user.id
    console.log('✅ USER CRIADO:', userId)

    // =============================
    // 🔍 VERIFICAR PROFILE POR ID (FIX DUPLICATE KEY)
    // =============================
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    console.log('📄 Criando/atualizando profile...')

    // =============================
    // 2️⃣ PROFILE (COM TELEFONE) - UPSERT
    // =============================
    const { error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        nome,
        email,
        telefone,
        role: 'profissional',
        first_login_completed: false
      })

    if (profileInsertError) {
      console.error('❌ ERRO PROFILE:', profileInsertError)

      await supabaseAdmin.auth.admin.deleteUser(userId)

      return new Response(JSON.stringify({ error: profileInsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // =============================
    // 3️⃣ PROFISSIONAL (SEM TELEFONE)
    // =============================
    console.log('💼 Criando profissional...')

    const { error: profissionalError } = await supabaseAdmin
      .from('profissionais')
      .insert({
        profile_id: userId
      })

    if (profissionalError) {
      console.error('❌ ERRO PROFISSIONAL:', profissionalError)

      try {
        await supabaseAdmin.auth.admin.deleteUser(userId)
        await supabaseAdmin.from('profiles').delete().eq('id', userId)
      } catch (rollbackError) {
        console.error('🔥 ERRO ROLLBACK COMPLETO:', rollbackError)
      }

      return new Response(JSON.stringify({ error: profissionalError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // =============================
    // 📋 RETORNAR DADOS COMPLETOS (JOIN)
    // =============================
    const { data: profissionalCompleto } = await supabaseAdmin
      .from('profissionais')
      .select(`
        id,
        profile_id,
        profiles (
          nome,
          email,
          telefone
        )
      `)
      .eq('profile_id', userId)
      .single()

    console.log('✅ PROFISSIONAL COMPLETO:', profissionalCompleto)

    // =============================
    // ✅ SUCESSO
    // =============================
    console.log('🎉 PROFISSIONAL CRIADO COM SUCESSO')

    return new Response(JSON.stringify({ 
      success: true,
      data: profissionalCompleto 
    }), {
      status: 201,
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