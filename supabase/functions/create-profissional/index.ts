// ========================================
// CREATE PROFISSIONAL - VERSÃO CORRETA
// ========================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabaseAnonKey = Deno.env.get('ANON_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader =
      req.headers.get('authorization') ||
      req.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Sem token' }), { status: 401 })
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // =============================
    // VALIDAR USER
    // =============================
    const { data: { user } } = await supabaseUser.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401 })
    }

    // =============================
    // VALIDAR ADMIN
    // =============================
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Apenas admin' }), { status: 403 })
    }

    // =============================
    // INPUT
    // =============================
    const { nome, email, password, telefone } = await req.json()

    if (!nome || !email || !password) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios' }), { status: 400 })
    }

    // =============================
    // CREATE USER (TRIGGER CRIA PROFILE)
    // =============================
    const { data: userData, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nome,
          telefone,
          role: 'profissional'
        }
      })

    if (createUserError) {
      console.error(createUserError)
      return new Response(JSON.stringify({ error: createUserError.message }), { status: 500 })
    }

    const userId = userData.user.id

    // =============================
    // CRIAR PROFISSIONAL
    // =============================
    const { error: profissionalError } = await supabaseAdmin
      .from('profissionais')
      .insert({
        profile_id: userId
      })

    if (profissionalError) {
      // rollback
      await supabaseAdmin.auth.admin.deleteUser(userId)

      return new Response(JSON.stringify({ error: profissionalError.message }), { status: 500 })
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: userId
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Erro desconhecido'
    }), { status: 500 })
  }
})