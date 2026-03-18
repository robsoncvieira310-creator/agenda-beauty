import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 🌐 CORS DINÂMICO - Permitir ambientes específicos (SEM FALLBACK)
function getCorsHeaders(origin: string | null) {
  const allowedOrigins = [
    'http://localhost:8000',  // Ambiente atual
    'http://localhost:3000',  // Fallback
    'https://robsoncvieira310-creator.github.io/agenda-beauty/',    // Produção
  ]
  
  // 🔒 MAIS SEGURO: Verificar wildcard para GitHub Pages
  const isGitHubPages = origin && origin.includes('.github.io')
  const allowedOrigin = allowedOrigins.includes(origin || '') || isGitHubPages ? origin : null
  
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
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 🔐 VALIDAÇÃO DE AUTENTICAÇÃO
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { headers: corsHeaders, status: 401 }
      )
    }

    // Criar cliente com ANON_KEY para validar token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
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

    // Obter usuário autenticado
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { headers: corsHeaders, status: 401 }
      )
    }

    // 🔒 VALIDAÇÃO DE ADMIN (ROBUSTA)
    let isAdmin = user.user_metadata?.role === 'admin'
    
    // Fallback: buscar role na tabela profiles se não existir no metadata
    if (!isAdmin && user.user_metadata?.role === undefined) {
      try {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        isAdmin = profile?.role === 'admin'
      } catch (profileError) {
        console.warn('⚠️ Erro ao buscar profile para validação de admin:', profileError)
        isAdmin = false
      }
    }
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado' }),
        { headers: corsHeaders, status: 403 }
      )
    }

    const { userId, novaSenha } = await req.json()

    if (!userId || !novaSenha) {
      return new Response(
        JSON.stringify({ error: 'userId e novaSenha são obrigatórios' }),
        { headers: corsHeaders, status: 400 }
      )
    }

    // 🔒 VALIDAÇÃO DE UUID
    if (!isValidUUID(userId)) {
      return new Response(
        JSON.stringify({ error: 'userId inválido' }),
        { headers: corsHeaders, status: 400 }
      )
    }

    // Criar cliente Supabase com SERVICE_ROLE_KEY
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('🔐 Reset de senha solicitado para usuário:', userId)

    // Atualizar senha no Supabase Auth usando SERVICE_ROLE_KEY
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { password: novaSenha }
    )

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

  } catch (error) {
    console.error('❌ Erro na Edge Function:', error.message)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { headers: corsHeaders, status: 500 }
    )
  }
})
