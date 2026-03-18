// 🔥 DESABILITA JWT (OBRIGATÓRIO PARA DEBUG)
export const config = {
  verify_jwt: false
}

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 🔒 SEGURANÇA POR API KEY INTERNA
const API_KEY = Deno.env.get('INTERNAL_API_KEY') || 'agenda-beauty-internal-key-2024'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  console.log('🔥 EDGE FUNCTION EXECUTANDO')

  // 🔒 VALIDAR API KEY INTERNA (ANTES DE QUALQUER LÓGICA)
  const requestApiKey = req.headers.get('x-api-key')
  
  if (!requestApiKey || requestApiKey !== API_KEY) {
    console.log('❌ API Key inválida ou ausente:', requestApiKey)
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  
  console.log('✅ API Key validada com sucesso')

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Método
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método não permitido' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { user_id, email } = body

    if (!user_id || !email) {
      return new Response(
        JSON.stringify({ error: 'user_id e email são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔐 Reset para:', user_id, email)

    // Cliente admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Buscar usuário
    const { data: { users }, error: listError } =
      await supabaseAdmin.auth.admin.listUsers()

    if (listError) throw listError

    const user = users.find(u => u.id === user_id)

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (user.email !== email) {
      return new Response(
        JSON.stringify({ error: 'Email não confere' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Gerar senha
    const senha = gerarSenhaTemporaria()
    console.log('🔑 Nova senha gerada')

    // Atualizar senha
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password: senha
      })

    if (updateError) throw updateError

    // Atualizar profile (opcional)
    await supabaseAdmin
      .from('profiles')
      .update({ first_login_completed: false })
      .eq('id', user_id)

    console.log('✅ SUCESSO')

    return new Response(
      JSON.stringify({
        success: true,
        senha_temporaria: senha
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ ERRO:', error)

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Gerador de senha
function gerarSenhaTemporaria(min = 6, max = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const tamanho = Math.floor(Math.random() * (max - min + 1)) + min

  let senha = ''
  for (let i = 0; i < tamanho; i++) {
    senha += chars[Math.floor(Math.random() * chars.length)]
  }

  if (!/\d/.test(senha)) {
    senha += Math.floor(Math.random() * 10)
  }

  return senha
}