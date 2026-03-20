import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  console.log('🔥 FUNÇÃO INICIADA')

  // =============================
  // CORS (IMPORTANTE)
  // =============================
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // =============================
    // 🔐 AUTH (CORRETO)
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

    // Cliente com SERVICE ROLE + header original
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    )

    // Validar usuário
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    console.log('👤 USER:', user)
    console.log('❌ USER ERROR:', userError)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // =============================
    // 🔒 VERIFICAR ADMIN
    // =============================
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    console.log('🔐 ROLE:', profile)

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
    // 1️⃣ CRIAR USER
    // =============================
    const { data: userData, error: createUserError } =
      await supabase.auth.admin.createUser({
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

    // =============================
    // 2️⃣ PROFILE
    // =============================
    const { error: profileInsertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        nome,
        email,
        role: 'profissional',
        first_login_completed: false
      })

    if (profileInsertError) {
      await supabase.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: profileInsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // =============================
    // 3️⃣ PROFISSIONAL
    // =============================
    const { error: profissionalError } = await supabase
      .from('profissionais')
      .insert({
        profile_id: userId,
        telefone
      })

    if (profissionalError) {
      await supabase.auth.admin.deleteUser(userId)
      await supabase.from('profiles').delete().eq('id', userId)

      return new Response(JSON.stringify({ error: profissionalError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // =============================
    // ✅ SUCESSO
    // =============================
    return new Response(JSON.stringify({ success: true }), {
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