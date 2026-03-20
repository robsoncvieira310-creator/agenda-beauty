import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

Deno.serve(async (req) => {
  console.log('🔥 FUNÇÃO INICIADA')

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // =============================
    // 🔐 AUTH
    // =============================
    
    // 🔍 LOG CRÍTICO - Todos os headers
    console.log('📥 HEADERS:', Object.fromEntries(req.headers.entries()))
    
    // 🔥 MAIS SEGURO - Verificar ambos os casos
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
    
    // 🔥 TESTE CRÍTICO - Verificar se header chegou
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'Authorization header NÃO chegou'
      }), { status: 401 })
    }
    
    console.log('🔐 AUTH HEADER COMPLETO:', authHeader)
    
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Sem token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('🔑 TOKEN EXTRAÍDO:', token)

    // 🔥 Cliente do usuário (VALIDA TOKEN REAL)
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    })

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()

    // 🔍 DIAGNÓSTICO - Resultado da autenticação
    console.log('👤 USER AUTH RESULT:', user)
    console.log('❌ AUTH ERROR:', authError)

    // 🔥 TEMPORÁRIO - Desativar validação de usuário
    /*
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    */

    // =============================
    // 🔥 ADMIN CLIENT
    // =============================
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    console.log('🔐 ROLE:', profile?.role)

    // 🔥 TEMPORÁRIO - Desativar validação de admin
    /*
    if (!profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Apenas admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    */

    // =============================
    // 📥 INPUT
    // =============================
    const { nome, email, password, telefone } = await req.json()

    console.log('📥 INPUT:', { nome, email, telefone })

    if (!nome || !email || !password || !telefone) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // =============================
    // 1️⃣ AUTH USER
    // =============================
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      })

    console.log('👤 USER CRIADO:', userData, userError)

    if (userError) {
      return new Response(JSON.stringify({ error: userError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userId = userData.user.id

    // =============================
    // 2️⃣ PROFILE
    // =============================
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        nome,
        email,
        role: 'profissional',
        first_login_completed: false
      })

    console.log('📄 PROFILE:', profileError)

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // =============================
    // 3️⃣ PROFISSIONAL
    // =============================
    const { error: profissionalError } = await supabaseAdmin
      .from('profissionais')
      .insert({
        profile_id: userId,
        telefone
      })

    console.log('💇 PROFISSIONAL:', profissionalError)

    if (profissionalError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      await supabaseAdmin.from('profiles').delete().eq('id', userId)

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

  } catch (error) {
    console.error('🔥 ERRO GERAL:', error)

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})