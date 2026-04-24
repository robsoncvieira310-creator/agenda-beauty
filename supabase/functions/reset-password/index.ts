import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

// CORS headers para permitir chamadas do frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. CORS + METHOD
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // 2. EXTRAIR JWT
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Token ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // 3. CLIENTES
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: { Authorization: `Bearer ${token}` }
      }
    })

    // 4. VALIDAR USUÁRIO AUTENTICADO
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. VALIDAR ROLE ADMIN
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Perfil não encontrado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Acesso negado: requer role admin' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. VALIDAR INPUT
    const body = await req.json()
    const { user_id, new_password } = body

    if (!user_id || !new_password) {
      return new Response(
        JSON.stringify({ error: 'user_id e new_password são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    if (!uuidRegex.test(user_id)) {
      return new Response(
        JSON.stringify({ error: 'user_id inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (new_password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Senha deve ter no mínimo 8 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. VALIDAR EXISTÊNCIA DO USUÁRIO
    const { data: userData, error: userFetchError } = await supabaseAdmin.auth.admin.getUserById(user_id)

    if (userFetchError || !userData) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 8. ATUALIZAR SENHA (CRÍTICO)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: new_password
    })

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar senha', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 9. MARCAR FIRST LOGIN
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ first_login_completed: false })
      .eq('id', user_id)

    if (profileUpdateError) {
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar perfil', details: profileUpdateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 10. LOGGING RESTRITO (SEM VAZAMENTO)
    console.log('[RESET PASSWORD]', {
      admin: user.id,
      target: user_id,
      timestamp: new Date().toISOString()
    })

    // 11. RESPONSE FINAL (SEM VAZAMENTO)
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Senha atualizada com sucesso',
        user_id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[RESET PASSWORD] Erro:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
