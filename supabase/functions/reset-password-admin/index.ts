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
    console.log('[DEBUG] Função iniciada')

    // 2. CLIENTE SERVICE ROLE (único cliente necessário)
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    console.log('[DEBUG] Criando cliente Supabase...')
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    console.log('[DEBUG] Cliente criado')

    // 3. EXTRAIR BODY
    console.log('[DEBUG] Lendo body...')
    let body
    try {
      body = await req.json()
      console.log('[DEBUG] Body recebido:', JSON.stringify(body))
    } catch (parseError: any) {
      console.error('[DEBUG] Erro ao parsear body:', parseError?.message || 'Unknown error')
      return new Response(
        JSON.stringify({ error: 'Body JSON invalido', details: parseError?.message || 'Unknown error' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { admin_id, user_id, new_password } = body
    console.log('[DEBUG] Campos extraidos:', { hasAdminId: !!admin_id, hasUserId: !!user_id, hasPassword: !!new_password })

    if (!admin_id || !user_id || !new_password) {
      console.log('[DEBUG] Campos obrigatorios ausentes')
      return new Response(
        JSON.stringify({ error: 'admin_id, user_id e new_password sao obrigatorios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. VALIDAR ADMIN (via Service Role, sem JWT ES256)
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

    // Permitir admin global (role: admin) ou admin de empresa (role: adm_empresa)
    const isGlobalAdmin = adminProfile.role === 'admin'
    const isEmpresaAdmin = adminProfile.role === 'adm_empresa'

    if (!isGlobalAdmin && !isEmpresaAdmin) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado: requer role admin ou adm_empresa' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminEmpresaId = adminProfile.empresa_id

    // 5. VALIDAR FORMATO UUID (8-4-4-4-12)
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

    // 6. VALIDAR EXISTENCIA DO USUARIO E PERMISSOES
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

    // adm_empresa so pode resetar senhas de profissionais da mesma empresa
    if (isEmpresaAdmin) {
      if (targetProfile.empresa_id !== adminEmpresaId) {
        return new Response(
          JSON.stringify({ error: 'Acesso negado: usuario nao pertence a sua empresa' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Nao permitir resetar senha de outros admins
      if (targetProfile.role === 'admin' || targetProfile.role === 'adm_empresa') {
        return new Response(
          JSON.stringify({ error: 'Acesso negado: nao pode resetar senha de outros administradores' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 7. VALIDAR EXISTENCIA NO AUTH
    const { data: userData, error: userFetchError } = await supabaseAdmin.auth.admin.getUserById(user_id)

    if (userFetchError || !userData) {
      return new Response(
        JSON.stringify({ error: 'Usuario nao encontrado no auth' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 8. ATUALIZAR SENHA (CRITICO)
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

    // 7. LOGGING RESTRITO (SEM VAZAMENTO)
    console.log('[RESET PASSWORD]', {
      admin: admin_id,
      target: user_id,
      timestamp: new Date().toISOString()
    })

    // 8. RESPONSE FINAL (SEM VAZAMENTO)
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