import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar se o usuário é admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Verificar se o usuário logado é admin
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar se é admin na tabela profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Access denied. Admin role required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { nome, email, senha_temporaria, telefone } = await req.json()

    // Validação dos campos
    if (!nome || !email || !senha_temporaria || !telefone) {
      return new Response(
        JSON.stringify({ 
          error: 'Campos obrigatórios: nome, email, senha_temporaria, telefone' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validação de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Email inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validação de senha (mínimo 6 caracteres)
    if (senha_temporaria.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Senha deve ter pelo menos 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔐 CRIANDO PROFISSIONAL:', { nome, email, telefone })

    // PASSO 1: Criar usuário no Supabase Auth
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: senha_temporaria,
      email_confirm: true, // ✅ Email já confirmado
      user_metadata: {
        nome: nome,
        role: 'profissional'
      }
    })

    if (userError) {
      console.error('❌ ERRO AO CRIAR USUÁRIO:', userError)
      
      // Tratar erros específicos
      if (userError.message.includes('User already registered')) {
        return new Response(
          JSON.stringify({ 
            error: 'Email já está registrado. Use um email diferente.',
            code: 'EMAIL_ALREADY_EXISTS'
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      if (userError.message.includes('rate limit')) {
        return new Response(
          JSON.stringify({ 
            error: 'Limite de criação excedido. Tente novamente em alguns minutos.',
            code: 'RATE_LIMIT_EXCEEDED'
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ 
          error: `Erro ao criar usuário: ${userError.message}`,
          code: 'USER_CREATION_ERROR'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ USUÁRIO CRIADO:', userData)

    // PASSO 2: Aguardar trigger criar profile (se existir)
    await new Promise(resolve => setTimeout(resolve, 1000))

    // PASSO 3: Atualizar profile com role e nome
    const { data: profileUpdate, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        nome: nome,
        role: 'profissional',
        first_login_completed: false // ✅ Primeiro login pendente
      })
      .eq('id', userData.user.id)
      .select()
      .single()

    if (updateError) {
      console.error('❌ ERRO AO ATUALIZAR PROFILE:', updateError)
      return new Response(
        JSON.stringify({ 
          error: `Erro ao atualizar profile: ${updateError.message}`,
          code: 'PROFILE_UPDATE_ERROR'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ PROFILE ATUALIZADO:', profileUpdate)

    // PASSO 4: Criar registro em profissionais
    const { data: profissionalData, error: profissionalError } = await supabaseAdmin
      .from('profissionais')
      .insert({
        profile_id: userData.user.id,
        telefone: telefone
      })
      .select()
      .single()

    if (profissionalError) {
      console.error('❌ ERRO AO CRIAR PROFISSIONAL:', profissionalError)
      return new Response(
        JSON.stringify({ 
          error: `Erro ao criar profissional: ${profissionalError.message}`,
          code: 'PROFISSIONAL_CREATION_ERROR'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ PROFISSIONAL CRIADO:', profissionalData)

    // PASSO 5: Inicializar serviços para o profissional
    try {
      const { data: servicos } = await supabaseAdmin
        .from('servicos')
        .select('id, duracao_min, valor')
        .eq('ativo', true)

      if (servicos && servicos.length > 0) {
        const servicosParaProfissional = servicos.map(servico => ({
          profissional_id: profissionalData.id,
          servico_id: servico.id,
          duracao: servico.duracao_min,
          valor: servico.valor || 0,
          ativo: true
        }))

        const { error: insertError } = await supabaseAdmin
          .from('profissional_servicos')
          .insert(servicosParaProfissional)

        if (insertError) {
          console.warn('⚠️ Erro ao inicializar serviços:', insertError)
        } else {
          console.log(`✅ ${servicosParaProfissional.length} serviços inicializados para o profissional`)
        }
      }
    } catch (error) {
      console.warn('⚠️ Erro ao inicializar serviços do profissional:', error)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Profissional criado com sucesso. Usuário deve fazer login com a senha temporária.',
        data: {
          user: {
            id: userData.user.id,
            email: userData.user.email,
            nome: nome
          },
          profissional: profissionalData,
          profile: profileUpdate
        }
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ ERRO GERAL:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
