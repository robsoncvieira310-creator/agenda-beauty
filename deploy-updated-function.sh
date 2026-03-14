#!/bin/bash

echo "🚀 DEPLOY EDGE FUNCTION ATUALIZADA"
echo "=================================="

# Deploy da função corrigida
echo "📦 Fazendo deploy da função corrigida..."
supabase functions deploy create-profissional

echo "✅ Deploy concluído!"
echo ""
echo "🎯 FLUXO CORRIGIDO:"
echo "1. Edge Function cria usuário no Auth"
echo "2. Trigger do banco cria profile automaticamente"
echo "3. Edge Function aguarda 1 segundo"
echo "4. Edge Function cria profissional com profile_id"
echo "5. Supabase envia email de convite"
echo ""
echo "🧪 Teste novamente em: http://localhost:8000/profissionais.html"
