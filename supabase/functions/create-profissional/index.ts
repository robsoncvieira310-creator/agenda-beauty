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
    // VALIDAR ADMIN + OBTER EMPRESA_ID
    // =============================
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, empresa_id')
      .eq('id', user.id)
      .single()

    if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'adm_empresa')) {
      return new Response(JSON.stringify({ error: 'Apenas admin ou admin de empresa' }), { status: 403 })
    }

    console.log(`[create-profissional] Admin empresa_id: ${adminProfile.empresa_id}`)

    // =============================
    // INPUT
    // =============================
    const { nome, email, password, telefone } = await req.json()

    if (!nome || !email || !password) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios: nome, email, password' }), { status: 400 })
    }

    console.log(`[create-profissional] Iniciando criação: ${email}`)

    // =============================
    // VERIFICAR SE EMAIL JÁ EXISTE
    // =============================
    console.log(`[create-profissional] Verificando se email existe: ${email}`)
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      console.error('[create-profissional] Erro ao listar usuários:', listError)
    } else if (existingUsers?.users?.some(u => u.email === email)) {
      console.log(`[create-profissional] Email já existe: ${email}`)
      return new Response(JSON.stringify({ error: 'Email já está registrado' }), { status: 409 })
    }

    // =============================
    // CREATE USER (TRIGGER CRIA PROFILE)
    // =============================
    console.log(`[create-profissional] Criando usuário no auth...`)
    
    let userData
    let createUserError
    
    try {
      const result = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nome,
          telefone: telefone || '',
          role: 'profissional',
          empresa_id: adminProfile.empresa_id
        }
      })
      userData = result.data
      createUserError = result.error
    } catch (err) {
      console.error('[create-profissional] EXCEÇÃO ao criar usuário:', err)
      return new Response(JSON.stringify({ 
        error: 'Erro interno ao criar usuário',
        details: err instanceof Error ? err.message : 'Erro desconhecido'
      }), { status: 500 })
    }

    if (createUserError) {
      console.error('[create-profissional] Erro ao criar usuário:', createUserError)
      
      // Verificar se é erro de email duplicado
      if (createUserError.message?.includes('already been registered') || 
          createUserError.message?.includes('already exists')) {
        return new Response(JSON.stringify({ error: 'Email já está registrado' }), { status: 409 })
      }
      
      return new Response(JSON.stringify({ 
        error: createUserError.message,
        code: createUserError.code || 'unknown'
      }), { status: 500 })
    }

    if (!userData?.user) {
      console.error('[create-profissional] userData.user é null/undefined')
      return new Response(JSON.stringify({ error: 'Erro inesperado: usuário criado mas dados não retornados' }), { status: 500 })
    }

    console.log(`[create-profissional] Usuário criado: ${userData.user.id}`)

    const userId = userData.user.id

    // =============================
    // VERIFICAR/CRiar PROFILE
    // =============================
    console.log(`[create-profissional] Verificando profile...`)
    
    // Aguardar um momento para o trigger criar o profile (se existir)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()
    
    if (profileCheckError || !existingProfile) {
      console.log(`[create-profissional] Profile não encontrado, criando manualmente...`)
      
      const { error: createProfileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          nome: nome,
          email: email,
          telefone: telefone || '',
          role: 'profissional'
        })
      
      if (createProfileError) {
        console.error('[create-profissional] Erro ao criar profile:', createProfileError)
        // rollback - deletar usuário auth
        await supabaseAdmin.auth.admin.deleteUser(userId)
        return new Response(JSON.stringify({ 
          error: 'Erro ao criar profile: ' + createProfileError.message 
        }), { status: 500 })
      }
      
      console.log(`[create-profissional] Profile criado manualmente`)
    } else {
      console.log(`[create-profissional] Profile já existe (trigger funcionou)`)
    }

    // =============================
    // CRIAR PROFISSIONAL
    // =============================
    console.log(`[create-profissional] Criando profissional...`)
    
    const { error: profissionalError } = await supabaseAdmin
      .from('profissionais')
      .insert({
        profile_id: userId,
        empresa_id: adminProfile.empresa_id
      })

    if (profissionalError) {
      console.error('[create-profissional] Erro ao criar profissional:', profissionalError)
      // rollback
      await supabaseAdmin.auth.admin.deleteUser(userId)

      return new Response(JSON.stringify({ error: profissionalError.message }), { status: 500 })
    }
    
    console.log(`[create-profissional] Profissional criado com sucesso`)

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