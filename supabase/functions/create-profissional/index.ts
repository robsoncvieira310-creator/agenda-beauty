import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

Deno.serve(async (req) => {
  console.log('🔥 FUNÇÃO INICIADA')

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return new Response(JSON.stringify({
    success: true,
    message: 'FUNÇÃO FUNCIONANDO'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})