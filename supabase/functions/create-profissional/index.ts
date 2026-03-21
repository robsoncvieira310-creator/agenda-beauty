// =============================
// 2️⃣ PROFILE (CORRIGIDO)
// =============================
const { error: profileError } = await supabaseAdmin
  .from('profiles')
  .upsert({
    id: userId,
    nome,
    email,
    role: 'profissional',
    first_login_completed: false
  })

if (profileError) {
  console.error('❌ ERRO PROFILE:', profileError)

  try {
    await supabaseAdmin.auth.admin.deleteUser(userId)
  } catch (rollbackError) {
    console.error('🔥 ERRO ROLLBACK USER:', rollbackError)
  }

  return new Response(JSON.stringify({ error: profileError.message }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}


// =============================
// 3️⃣ PROFISSIONAL (CORRIGIDO)
// =============================
const { error: profissionalError } = await supabaseAdmin
  .from('profissionais')
  .upsert({
    profile_id: userId,
    telefone
  })

if (profissionalError) {
  console.error('❌ ERRO PROFISSIONAL:', profissionalError)

  try {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    await supabaseAdmin.from('profiles').delete().eq('id', userId)
  } catch (rollbackError) {
    console.error('🔥 ERRO ROLLBACK COMPLETO:', rollbackError)
  }

  return new Response(JSON.stringify({ error: profissionalError.message }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}