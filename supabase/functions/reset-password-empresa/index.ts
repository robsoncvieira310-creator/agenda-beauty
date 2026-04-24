import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

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
      JSON.stringify({ error: 'Metodo nao permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    console.log('[RESET PASSWORD EMPRESA] Função iniciada')

    // 2. CLIENTE SERVICE ROLE
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 3. EXTRAIR BODY
    let body
    try {
      body = await req.json()
      console.log('[RESET PASSWORD EMPRESA] Body recebido:', JSON.stringify(body))
    } catch (parseError: any) {
      console.error('[RESET PASSWORD EMPRESA] Erro ao parsear body:', parseError?.message)
      return new Response(
        JSON.stringify({ error: 'Body JSON invalido', details: parseError?.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { admin_id, user_id, new_password } = body

    if (!admin_id || !user_id || !new_password) {
      return new Response(
        JSON.stringify({ error: 'admin_id, user_id e new_password sao obrigatorios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. VALIDAR ADMIN E OBTER EMPRESA_ID
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('role, empresa_id')
      .eq('id', admin_id)
      .single()

    if (adminError || !adminProfile) {
      return new Response(
        JSON.stringify({ error: 'Admin nao encontrado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Apenas admin global (role: admin) pode resetar senhas de empresas
    if (adminProfile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Acesso negado: requer role admin' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. VALIDAR FORMATO UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (!uuidRegex.test(user_id)) {
      return new Response(
        JSON.stringify({ error: 'user_id invalido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (new_password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Senha deve ter no minimo 8 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. VALIDAR EXISTENCIA DO USUARIO ALVO E VERIFICAR EMPRESA
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, empresa_id, role')
      .eq('id', user_id)
      .single()

    if (targetError || !targetProfile) {
      return new Response(
        JSON.stringify({ error: 'Usuario nao encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[RESET PASSWORD EMPRESA] Target profile:', targetProfile)

    // 7. VERIFICAR SE USUARIO EXISTE NO AUTH
    const { data: userData, error: userFetchError } = await supabaseAdmin.auth.admin.getUserById(user_id)

    if (userFetchError || !userData) {
      return new Response(
        JSON.stringify({ error: 'Usuario nao encontrado no auth' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 9. ATUALIZAR SENHA
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: new_password
    })

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar senha', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 10. MARCAR FIRST LOGIN (opcional - para forcar troca de senha no primeiro acesso)
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ first_login_completed: false })
      .eq('id', user_id)

    if (profileUpdateError) {
      console.warn('[RESET PASSWORD EMPRESA] Erro ao atualizar perfil:', profileUpdateError.message)
      // Nao falha a operacao principal se isso falhar
    }

    // 11. LOGGING
    console.log('[RESET PASSWORD EMPRESA]', {
      admin: admin_id,
      admin_role: adminProfile.role,
      target: user_id,
      target_empresa: targetProfile.empresa_id,
      timestamp: new Date().toISOString()
    })

    // 12. RESPONSE FINAL
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Senha atualizada com sucesso',
        user_id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[RESET PASSWORD EMPRESA] Erro:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
