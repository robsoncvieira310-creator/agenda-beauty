import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 🔥 DEBUG DE INFRAESTRUTURA - DESABILITAR VERIFICAÇÃO JWT TEMPORARIAMENTE
export const config = {
  verify_jwt: false
}

// 🌐 CORS DINÂMICO - Permitir ambientes específicos (SEM FALLBACK)
function getCorsHeaders(origin: string | null) {
  const allowedOrigins = [
    'http://localhost:8000',  // Ambiente atual
    'http://localhost:3000',  // Fallback
    'https://robsoncvieira310-creator.github.io/agenda-beauty/',    // Produção
  ]
  
  // � DEBUG: Log da origem recebida
  console.log('🌐 Origin recebido:', origin)
  
  // � MAIS SEGURO: Verificar wildcard para GitHub Pages
  const isGitHubPages = origin && origin.includes('.github.io')
  const isAllowed = allowedOrigins.includes(origin || '') || isGitHubPages
  
  // 🔍 DEBUG: Log da verificação
  console.log('🔍 Verificação CORS:', {
    origin,
    allowedOrigins,
    isGitHubPages,
    isAllowed
  })
  
  // 🚨 TEMPORÁRIO PARA DEBUG: Fallback para localhost se não permitido
  const allowedOrigin = isAllowed ? origin : 'http://localhost:8000'
  
  console.log('🔍 AllowedOrigin final:', allowedOrigin)
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',  // 🌐 SUPORTE COMPLETO A PREFLIGHT
    'Content-Type': 'application/json'
  }
}

// 🔒 VALIDAÇÃO DE UUID
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

serve(async (req) => {
  // 🔥 LOG BÁSICO PARA CONFIRMAR EXECUÇÃO
  console.log('🔥 EDGE FUNCTION EXECUTANDO')
  
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 🔍 ETAPA 1 — LOGAR HEADER RECEBIDO
    const authHeader = req.headers.get('Authorization')
    
    console.log('🔍 HEADER AUTH:', authHeader ? 'EXISTS' : 'NULL')
    
    if (authHeader) {
      console.log('🔍 TOKEN (início):', authHeader.substring(0, 30))
    }

    if (!authHeader) {
      console.log('❌ HEADER AUTH NULO')
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { headers: corsHeaders, status: 401 }
      )
    }

    // 🔍 ETAPA 2 — VALIDAR TOKEN COM CLIENT ANON
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    console.log('🔍 CRIANDO CLIENT ANON...')
    console.log('🔍 SUPABASE_URL:', !!supabaseUrl)
    console.log('🔍 SUPABASE_ANON_KEY:', !!supabaseAnonKey)

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('🔍 CHAMANDO getUser()...')
    const { data, error } = await supabaseUser.auth.getUser()
    
    console.log('🔍 RESULT getUser:')
    console.log('  user:', data?.user)
    console.log('  error:', error)
    
    if (error || !data?.user) {
      console.log('❌ FALHA NA VALIDAÇÃO DO TOKEN')
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { headers: corsHeaders, status: 401 }
      )
    }

    console.log('✅ TOKEN VÁLIDO - USER ID:', data.user.id)

    // 🔒 VALIDAÇÃO DE ADMIN (NO BANCO)
    try {
      console.log('🔍 VERIFICANDO ROLE ADMIN...')
      const { data: profile, error: profileError } = await supabaseUser
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()
      
      console.log('🔍 RESULT PROFILE:')
      console.log('  profile:', profile)
      console.log('  profileError:', profileError)
      
      if (profileError || !profile) {
        console.error('❌ Erro ao buscar profile:', profileError)
        return new Response(
          JSON.stringify({ error: 'Acesso negado' }),
          { headers: corsHeaders, status: 403 }
        )
      }
      
      if (profile.role !== 'admin') {
        console.warn('⚠️ Usuário não é admin:', data.user.id, profile.role)
        return new Response(
          JSON.stringify({ error: 'Acesso negado' }),
          { headers: corsHeaders, status: 403 }
        )
      }
      
      console.log('✅ Admin validado:', data.user.id)
      
    } catch (profileError) {
      console.error('❌ Erro na validação de admin:', profileError)
      return new Response(
        JSON.stringify({ error: 'Erro de validação' }),
        { headers: corsHeaders, status: 500 }
      )
    }

    const { userId, novaSenha } = await req.json()
    
    console.log('🔍 DADOS RECEBIDOS:')
    console.log('  userId:', userId)
    console.log('  novaSenha:', novaSenha ? '***' : 'NULL')

    if (!userId || !novaSenha) {
      console.log('❌ DADOS OBRIGATÓRIOS FALTANDO')
      return new Response(
        JSON.stringify({ error: 'userId e novaSenha são obrigatórios' }),
        { headers: corsHeaders, status: 400 }
      )
    }

    // 🔒 VALIDAÇÃO DE UUID
    if (!isValidUUID(userId)) {
      console.log('❌ UUID INVÁLIDO:', userId)
      return new Response(
        JSON.stringify({ error: 'userId inválido' }),
        { headers: corsHeaders, status: 400 }
      )
    }

    // 🔍 ETAPA 3 — LOGAR ANTES DE QUALQUER AÇÃO ADMIN
    console.log('🔍 INDO PARA OPERAÇÃO ADMIN...')

    // 🔍 ETAPA 4 — LOGAR CLIENT ADMIN
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    console.log('🔍 SERVICE ROLE ATIVO:', !!supabaseServiceKey)

    if (!supabaseServiceKey) {
      console.log('❌ SERVICE ROLE KEY NÃO ENCONTRADA')
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta' }),
        { headers: corsHeaders, status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('🔐 Reset de senha solicitado para usuário:', userId)

    // Atualizar senha no Supabase Auth usando SERVICE_ROLE_KEY
    console.log('🔍 EXECUTANDO updateUserById...')
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { password: novaSenha }
    )

    console.log('🔍 RESULT updateUserById:')
    console.log('  updateError:', updateError)

    if (updateError) {
      console.error('❌ Erro ao atualizar senha:', updateError.message)
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar senha: ' + updateError.message }),
        { headers: corsHeaders, status: 500 }
      )
    }

    console.log('✅ Senha atualizada com sucesso')

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Senha atualizada com sucesso' 
      }),
      { headers: corsHeaders, status: 200 }
    )

  } catch (err) {
    // 🔍 ETAPA 5 — TRY/CATCH GLOBAL
    console.error('❌ ERRO GERAL:', err)
    console.error('❌ STACK TRACE:', err.stack)
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: corsHeaders, status: 500 }
    )
  }
})
