import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
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

    const { nome, telefone, email } = await req.json()

    if (!nome || !telefone || !email) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: nome, telefone, email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔐 CRIANDO PROFISSIONAL:', { nome, telefone, email })

    // Criar cliente Supabase com Service Role Key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 1. Convidar usuário pelo email
    console.log('� PASSO 1: Convidando profissional pelo email...')
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          nome: nome,
          telefone: telefone,
          role: 'profissional'
        }
      }
    )

    if (inviteError) {
      console.error('❌ ERRO AO CONVIDAR USUÁRIO:', inviteError)
      
      // Verificar se o erro é de email já existente
      if (inviteError.message.includes('already been registered') || inviteError.message.includes('duplicate')) {
        return new Response(
          JSON.stringify({ 
            error: `Este email já está registrado. Use um email diferente ou verifique se o profissional já existe.`, 
            code: 'EMAIL_ALREADY_EXISTS',
            details: inviteError.message 
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: `Erro ao convidar usuário: ${inviteError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ USUÁRIO CONVIDADO:', inviteData)

    // Se não tiver dados do usuário, buscar pelo email
    let userId = null;
    if (inviteData.user && inviteData.user.id) {
      userId = inviteData.user.id;
    } else {
      // Buscar usuário pelo email
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserByEmail(email);
      if (userError || !userData.user) {
        console.error('❌ ERRO AO BUSCAR USUÁRIO:', userError);
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar dados do usuário convidado' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = userData.user.id;
    }

    // 2. Aguardar a criação automática do profile
    console.log('👤 PASSO 2: Aguardando trigger criar profile...')
    await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 segundos para o trigger
    
    // 3. Verificar se já existe profissional com esse profile_id
    console.log('🔍 PASSO 3: Verificando se profissional já existe...')
    const { data: existingProfissional, error: checkError } = await supabaseAdmin
      .from('profissionais')
      .select('id')
      .eq('profile_id', userId)
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ ERRO AO VERIFICAR PROFISSIONAL:', checkError)
      return new Response(
        JSON.stringify({ 
          error: `Erro ao verificar profissional existente: ${checkError.message}`,
          details: 'Falha na consulta de verificação'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (existingProfissional) {
      console.log('⚠️ PROFISSIONAL JÁ EXISTE:', existingProfissional)
      return new Response(
        JSON.stringify({ 
          error: 'Profissional já existe para este usuário',
          details: 'Cada profile pode ter apenas um profissional',
          profissional_id: existingProfissional.id
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Criar profissional manualmente
    console.log('💼 PASSO 4: Criando profissional manualmente...')
    const { data: profissionalData, error: profissionalError } = await supabaseAdmin
      .from('profissionais')
      .insert({
        profile_id: userId,
        nome: nome,
        telefone: telefone,
        email: email
      })
      .select()
      .single()

    if (profissionalError) {
      console.error('❌ ERRO AO CRIAR PROFISSIONAL:', profissionalError)
      return new Response(
        JSON.stringify({ 
          error: `Erro ao criar profissional: ${profissionalError.message}`,
          details: 'Verifique se o profile foi criado corretamente'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ PROFISSIONAL CRIADO MANUALMENTE:', profissionalData)

    // 5. Enviar email de convite (automático via Supabase)
    console.log('📧 PASSO 5: Email de convite enviado automaticamente')

    const response = {
      success: true,
      message: 'Profissional convidado com sucesso! Email de convite enviado para criação de senha.',
      data: {
        user: { id: userId, email: email },
        profissional: profissionalData
      }
    }

    console.log('🎉 SUCESSO COMPLETO:', response)

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('❌ ERRO GERAL:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
