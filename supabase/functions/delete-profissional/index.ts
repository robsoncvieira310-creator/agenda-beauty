// ========================================
// 🔥 DELETE PROFISSIONAL - EDGE FUNCTION
// ========================================
// ✅ VERSÃO CORRIGIDA - SEM ERROS DE TIPO UUID vs INTEGER
// 
// 📋 REGRAS OBRIGATÓRIAS DE TIPOS:
// 
// ✅ SEMPRE USAR UUID PARA:
// - profiles.id
// - auth.users.id  
// - profissionais.profile_id
// - audit_logs.record_id
// - audit_logs.user_id
// 
// ❌ NUNCA USAR INTEGER PARA:
// - Operações com auth/users
// - Operações com profiles
// - Operações com audit_logs
// 
// ✅ USAR INTEGER APENAS PARA:
// - profissionais.id (relacionamentos internos)
// - agendamentos.profissional_id (relacionamento interno)
// - bloqueios.profissional_id (relacionamento interno)
// 
// 🔄 FLUXO CORRETO:
// 1. Receber profile_id (UUID) no body
// 2. Validar que é string (UUID)
// 3. Usar profile_id para operações com auth/profiles/audit
// 4. Buscar profissional.id (INTEGER) apenas para deletar dados relacionados
// 5. Registrar auditoria com profile_id (UUID)
// ========================================

import { createClient } from "@supabase/supabase-js"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

// 🔐 ENV
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

Deno.serve(async (req) => {
  console.log('🔥 DELETE PROFISSIONAL INICIADA')

  // =============================
  // 🌐 CORS
  // =============================
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // =============================
  // 📥 INPUT
  // =============================
  try {
    const { profile_id } = await req.json()

    // ✅ VALIDAÇÃO: Garantir que profile_id é string (UUID)
    if (!profile_id || typeof profile_id !== 'string') {
      return new Response(JSON.stringify({ 
        error: 'profile_id é obrigatório e deve ser string (UUID)' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('📥 PROFILE_ID (UUID):', profile_id)

    // =============================
    // 🔐 AUTH HEADER
    // =============================
    const authHeader =
      req.headers.get('authorization') ||
      req.headers.get('Authorization')

    console.log('🔐 AUTH HEADER:', authHeader)

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Sem token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // =============================
    // 👤 CLIENT USER (JWT)
    // =============================
    const supabaseUser = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    )

    // =============================
    // 👑 CLIENT ADMIN
    // =============================
    console.log('🔑 SERVICE KEY EXISTS:', !!supabaseServiceKey)
    console.log('🔑 SERVICE KEY LENGTH:', supabaseServiceKey?.length)
    
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey
    )

    // =============================
    // ✅ VALIDAR USUÁRIO
    // =============================
    console.log('USER CLIENT OK')
    const {
      data: { user },
      error: userError
    } = await supabaseUser.auth.getUser()

    console.log('👤 USER:', user)
    console.log('❌ USER ERROR:', userError)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // =============================
    // 🔒 VALIDAR ADMIN
    // =============================
    console.log('ADMIN CLIENT OK')
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    console.log('🔐 ROLE:', profile)
    console.log('❌ PROFILE ERROR:', profileError)

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Apenas admin pode deletar profissionais' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // =============================
    // 🔍 VERIFICAR SE PROFISSIONAL EXISTE (usando profile_id UUID)
    // =============================
    console.log('🔍 VERIFICANDO PROFISSIONAL...')
    const { data: profissional, error: profissionalError } = await supabaseAdmin
      .from('profissionais')
      .select('profile_id')
      .eq('profile_id', profile_id) // ✅ Usando profile_id (UUID)
      .single()

    if (profissionalError || !profissional) {
      return new Response(JSON.stringify({ error: 'Profissional não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('✅ PROFISSIONAL ENCONTRADO:', profissional)

    // =============================
    // 🗑️ FLUXO COMPLETO DE EXCLUSÃO (ORDEM CRÍTICA)
    // =============================
    
    // 1. Deletar dados dependentes (usando profissional.id INTEGER apenas para relacionamentos internos)
    console.log('🗑️ 1️⃣ DELETANDO DADOS DEPENDENTES...')
    
    // Buscar o ID interno (INTEGER) apenas para deletar dados relacionados
    const { data: profData, error: profError } = await supabaseAdmin
      .from('profissionais')
      .select('id')
      .eq('profile_id', profile_id) // ✅ Buscar por profile_id (UUID)
      .single()
    
    if (profError || !profData) {
      console.error('❌ ERRO BUSCAR PROFISSIONAL ID:', profError)
      // Continuar mesmo sem encontrar dados relacionados
    } else {
      console.log('✅ PROFISSIONAL ID INTERNO ENCONTRADO:', profData.id)
      
      // Deletar agendamentos (relacionamento interno com INTEGER)
      const { error: agendamentosError } = await supabaseAdmin
        .from('agendamentos')
        .delete()
        .eq('profissional_id', profData.id) // ✅ INTEGER para relação interna

      if (agendamentosError) {
        console.error('❌ ERRO DELETE AGENDAMENTOS:', agendamentosError)
        // Não falhar aqui, só logar
      } else {
        console.log('✅ AGENDAMENTOS DELETADOS')
      }

      // Deletar bloqueios (se existir a tabela)
      try {
        const { error: bloqueiosError } = await supabaseAdmin
          .from('bloqueios')
          .delete()
          .eq('profissional_id', profData.id) // ✅ INTEGER para relação interna

        if (bloqueiosError) {
          console.error('❌ ERRO DELETE BLOQUEIOS:', bloqueiosError)
        } else {
          console.log('✅ BLOQUEIOS DELETADOS')
        }
      } catch (e) {
        console.log('⚠️ Tabela bloqueios não existe ou outro erro:', e)
      }
    }
    
    // 2. Deletar profissional (usando profile_id UUID)
    console.log('🗑️ 2️⃣ DELETANDO PROFISSIONAL...')
    const { error: deleteProfissionalError } = await supabaseAdmin
      .from('profissionais')
      .delete()
      .eq('profile_id', profile_id) // ✅ Usando profile_id (UUID)

    if (deleteProfissionalError) {
      console.error('❌ ERRO DELETE PROFISSIONAL:', deleteProfissionalError)
      return new Response(JSON.stringify({ 
        error: 'Erro ao deletar profissional',
        details: deleteProfissionalError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('✅ PROFISSIONAL DELETADO')

    // 3. Deletar profile (usando profile_id UUID)
    console.log('🗑️ 3️⃣ DELETANDO PROFILE...')
    const { error: deleteProfileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', profile_id) // ✅ Usando profile_id (UUID)

    if (deleteProfileError) {
      console.error('❌ ERRO DELETE PROFILE:', deleteProfileError)
      return new Response(JSON.stringify({ 
        error: 'Erro ao deletar profile',
        details: deleteProfileError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('✅ PROFILE DELETADO')

    // 4. Deletar auth user (POR ÚLTIMO)
    console.log('🗑️ 4️⃣ DELETANDO AUTH USER...')
    
    try {
      console.log("🔍 Deletando usuário do auth:", profile_id)

      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(profile_id)

      if (deleteUserError) {
        console.error("❌ Erro ao deletar auth:", deleteUserError)
        return new Response(JSON.stringify({ 
          error: 'Erro ao deletar usuário do auth',
          details: deleteUserError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log('✅ AUTH USER DELETADO')

    } catch (err) {
      console.error("🔥 CRASH NO DELETE USER:", err)
      return new Response(JSON.stringify({ 
        error: 'Erro interno ao deletar usuário do auth',
        details: err.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 5. Registrar auditoria (usando profile_id UUID)
    console.log('📋 5️⃣ REGISTRANDO AUDITORIA...')
    try {
      const { error: auditError } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          table_name: 'profissionais',
          record_id: profile_id, // ✅ UUID correto
          action: 'DELETE',
          user_id: user.id // ✅ UUID do usuário que realizou a operação
        })

      if (auditError) {
        console.error('❌ ERRO AUDITORIA:', auditError)
        // Não falhar a operação principal por erro na auditoria
      } else {
        console.log('✅ AUDITORIA REGISTRADA')
      }
    } catch (e) {
      console.error('⚠️ ERRO AO REGISTRAR AUDITORIA:', e)
      // Não falhar a operação principal
    }

    // =============================
    // ✅ SUCESSO
    // =============================
    console.log('🎉 PROFISSIONAL DELETADO COM SUCESSO')

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Profissional deletado com sucesso',
      deleted_profile_id: profile_id,
      audit: {
        table: 'profissionais',
        record_id: profile_id, // ✅ UUID
        action: 'DELETE',
        user_id: user.id // ✅ UUID
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('🔥 ERRO GERAL:', err)

    return new Response(JSON.stringify({ 
      error: 'Erro interno ao deletar profissional',
      details: err.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
