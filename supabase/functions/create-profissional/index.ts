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
    const { nome, email, senha_temporaria, telefone } = await req.json()

    // Validações
    if (!nome || !email || !senha_temporaria || !telefone) {
      return new Response(
        JSON.stringify({ 
          error: 'Campos obrigatórios: nome, email, senha_temporaria, telefone' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ 
          error: 'Email inválido' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar senha
    if (senha_temporaria.length < 6) {
      return new Response(
        JSON.stringify({ 
          error: 'Senha deve ter pelo menos 6 caracteres' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔐 CRIANDO PROFISSIONAL:', { nome, email, telefone })

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // PASSO 1: Criar usuário no auth
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: senha_temporaria,
      email_confirm: true,
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

    // PASSO 2: Criar registro em profiles
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userData.user.id,
        nome: nome,
        email: email,
        role: 'profissional',
        first_login_completed: false
      })
      .select()
      .single()

    if (profileError) {
      console.error('❌ ERRO AO CRIAR PROFILE:', profileError)
      return new Response(
        JSON.stringify({ 
          error: `Erro ao criar profile: ${profileError.message}`,
          code: 'PROFILE_CREATION_ERROR'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ PROFILE CRIADO:', profileData)

    // PASSO 3: Criar registro em profissionais
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

    // PASSO 4: Inicializar serviços para o profissional
    try {
      const { data: servicos } = await supabaseAdmin
        .from('servicos')
        .select('id')
        .eq('ativo', true)

      if (servicos && servicos.length > 0) {
        const servicosParaProfissional = servicos.map(servico => ({
          profissional_id: profissionalData.id,
          servico_id: servico.id
        }))

        const { error: servicosError } = await supabaseAdmin
          .from('profissional_servicos')
          .insert(servicosParaProfissional)

        if (servicosError) {
          console.warn('⚠️ Erro ao inicializar serviços:', servicosError)
        } else {
          console.log(`✅ ${servicosParaProfissional.length} serviços inicializados`)
        }
      }
    } catch (servicosError) {
      console.warn('⚠️ Erro ao inicializar serviços:', servicosError)
    }

    // ✅ SUCESSO - Retornar estrutura completa
    return new Response(
      JSON.stringify({
        success: true,
        user_id: userData.user.id,
        profile_id: profileData.id,
        profissional_id: profissionalData.id,
        message: 'Profissional criado com sucesso. Usuário deve fazer login com a senha temporária.',
        data: {
          user: {
            id: userData.user.id,
            email: userData.user.email,
            nome: nome
          },
          profile: profileData,
          profissional: profissionalData
        }
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ ERRO GERAL:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
