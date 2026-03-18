import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers para permitir chamadas do frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar método HTTP
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método não permitido' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse body da requisição
    const body = await req.json()
    const { user_id, email } = body

    // Validações obrigatórias
    if (!user_id || !email) {
      return new Response(
        JSON.stringify({ 
          error: 'user_id e email são obrigatórios',
          details: 'Forneça user_id (UUID) e email (string) no corpo da requisição'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validar formato do user_id (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(user_id)) {
      return new Response(
        JSON.stringify({ 
          error: 'user_id inválido',
          details: 'O user_id deve ser um UUID válido'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('🔐 Iniciando reset de senha para user_id:', user_id)
    console.log('📧 Email:', email)

    // Criar cliente Supabase com SERVICE_ROLE_KEY (apenas no backend)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 1. Verificar se o usuário existe no auth.users
    console.log('🔍 Verificando existência do usuário...')
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      per_page: 1000
    })

    if (listError) {
      console.error('❌ Erro ao listar usuários:', listError)
      throw new Error('Erro ao verificar usuários no sistema')
    }

    const userExists = users.find(u => u.id === user_id)
    if (!userExists) {
      return new Response(
        JSON.stringify({ 
          error: 'Usuário não encontrado',
          details: 'Nenhum usuário encontrado com o user_id fornecido'
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 2. Verificar se o email corresponde ao usuário
    if (userExists.email !== email) {
      return new Response(
        JSON.stringify({ 
          error: 'Email não corresponde ao usuário',
          details: 'O email fornecido não corresponde ao email do usuário'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Usuário verificado:', userExists.email)

    // 3. Gerar senha temporária segura
    const senhaTemporaria = gerarSenhaTemporaria(6, 8)
    console.log('🔑 Senha temporária gerada')

    // 4. Atualizar senha usando Admin API
    console.log('🔄 Atualizando senha no Auth...')
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { 
        password: senhaTemporaria,
        email_confirm: true // Garantir que email está confirmado
      }
    )

    if (updateError) {
      console.error('❌ Erro ao atualizar senha:', updateError)
      throw new Error('Erro ao atualizar senha do usuário')
    }

    console.log('✅ Senha atualizada com sucesso')

    // 5. Atualizar profile - first_login_completed = false
    console.log('🔄 Atualizando profile...')
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ first_login_completed: false })
      .eq('id', user_id)

    if (profileError) {
      console.warn('⚠️ Erro ao atualizar profile:', profileError)
      // Não falhar o processo principal se isso falhar
    } else {
      console.log('✅ Profile atualizado com sucesso')
    }

    // 6. Retornar sucesso (senha temporária incluída)
    const resultado = {
      success: true,
      message: 'Senha redefinida com sucesso!',
      user_id: user_id,
      email: email,
      senha_temporaria: senhaTemporaria, // Apenas para exibição ao admin
      timestamp: new Date().toISOString()
    }

    console.log('🎉 Reset de senha concluído com sucesso')

    return new Response(
      JSON.stringify(resultado),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Erro no processamento:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Função para gerar senha temporária segura
function gerarSenhaTemporaria(min = 6, max = 8): string {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const tamanho = Math.floor(Math.random() * (max - min + 1)) + min
  let senha = ''
  
  for (let i = 0; i < tamanho; i++) {
    senha += caracteres.charAt(Math.floor(Math.random() * caracteres.length))
  }
  
  // Garantir que tenha pelo menos um número
  if (!/\d/.test(senha)) {
    senha = senha.slice(0, -1) + Math.floor(Math.random() * 10)
  }
  
  return senha
}
