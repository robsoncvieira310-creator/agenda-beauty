import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

// CORS headers para permitir chamadas do frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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
    // 1. Ler body para determinar ação
    const body = await req.json()
    const { action, userId, current_password, new_password } = body

    // 2. Clientes Supabase
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 3. MODO CHECK: Verificar first_login_completed sem JWT
    if (action === 'check') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'userId é obrigatório para action=check' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('first_login_completed')
        .eq('id', userId)
        .single()

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ error: 'Perfil não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ first_login_completed: profile.first_login_completed }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. MODO CHANGE: Troca de senha com JWT (lógica original)
    if (action !== 'change') {
      return new Response(
        JSON.stringify({ error: 'Action deve ser "check" ou "change"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar token JWT
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Token ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    // Validar usuário autenticado
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // VERIFICAÇÃO CRÍTICA: First Login
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('first_login_completed')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Perfil não encontrado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // SÓ PERMITIR SE first_login_completed === false
    if (profile.first_login_completed !== false) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado: primeiro login já foi completado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar input
    if (!current_password || !new_password) {
      return new Response(
        JSON.stringify({ error: 'current_password e new_password são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (new_password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Nova senha deve ter no mínimo 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Verificar senha atual usando signIn
    const { error: signInError } = await supabaseUser.auth.signInWithPassword({
      email: user.email!,
      password: current_password
    })

    if (signInError) {
      return new Response(
        JSON.stringify({ error: 'Senha atual incorreta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. Atualizar senha
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: new_password
    })

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar senha', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 8. Marcar primeiro login como completado
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ first_login_completed: true })
      .eq('id', user.id)

    if (profileUpdateError) {
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar perfil', details: profileUpdateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[FIRST LOGIN CHANGE PASSWORD]', {
      userId: user.id,
      timestamp: new Date().toISOString()
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Senha alterada com sucesso'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[FIRST LOGIN CHANGE PASSWORD] Erro:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
