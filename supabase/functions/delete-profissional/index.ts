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

    if (!profile_id) {
      return new Response(JSON.stringify({ error: 'profile_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('📥 PROFILE_ID:', profile_id)

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
    // 🔍 VERIFICAR SE PROFISSIONAL EXISTE
    // =============================
    console.log('🔍 VERIFICANDO PROFISSIONAL...')
    const { data: profissional, error: profissionalError } = await supabaseAdmin
      .from('profissionais')
      .select('profile_id')
      .eq('profile_id', profile_id)
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
    
    // 1. Deletar dados dependentes (agendamentos)
    console.log('🗑️ 1️⃣ DELETANDO AGENDAMENTOS...')
    
    // Primeiro buscar o ID do profissional na tabela profissionais
    const { data: profData, error: profError } = await supabaseAdmin
      .from('profissionais')
      .select('id')
      .eq('profile_id', profile_id)
      .single()
    
    if (profError || !profData) {
      console.error('❌ ERRO BUSCAR PROFISSIONAL ID:', profError)
      // Continuar mesmo sem agendamentos
    } else {
      console.log('✅ PROFISSIONAL ID ENCONTRADO:', profData.id)
      
      const { error: agendamentosError } = await supabaseAdmin
        .from('agendamentos')
        .delete()
        .eq('profissional_id', profData.id)

      if (agendamentosError) {
        console.error('❌ ERRO DELETE AGENDAMENTOS:', agendamentosError)
        // Não falhar aqui, só logar
      } else {
        console.log('✅ AGENDAMENTOS DELETADOS')
      }
    }
    
    // 2. Deletar profissional
    console.log('🗑️ 2️⃣ DELETANDO PROFISSIONAL...')
    const { error: profissionalError } = await supabaseAdmin
      .from('profissionais')
      .delete()
      .eq('profile_id', profile_id)

    if (profissionalError) {
      console.error('❌ ERRO DELETE PROFISSIONAL:', profissionalError)
      return new Response(JSON.stringify({ 
        error: 'Erro ao deletar profissional',
        details: profissionalError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('✅ PROFISSIONAL DELETADO')

    // 3. Deletar profile
    console.log('🗑️ 3️⃣ DELETANDO PROFILE...')
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', profile_id)

    if (profileError) {
      console.error('❌ ERRO DELETE PROFILE:', profileError)
      return new Response(JSON.stringify({ 
        error: 'Erro ao deletar profile',
        details: profileError.message 
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

    // =============================
    // ✅ SUCESSO
    // =============================
    console.log('🎉 PROFISSIONAL DELETADO COM SUCESSO')

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Profissional deletado com sucesso',
      deleted_profile_id: profile_id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('🔥 ERRO GERAL:', err)

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
