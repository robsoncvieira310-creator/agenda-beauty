#!/bin/bash

echo "🚀 DEPLOY EDGE FUNCTION - AGENDA BEAUTY"
echo "=========================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para imprimir mensagens coloridas
print_msg() {
    echo -e "${2}${1}${NC}"
}

print_msg "🔍 Verificando Supabase CLI..." $BLUE

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    print_msg "❌ Supabase CLI não encontrado!" $RED
    print_msg "📦 Instale com: npm install -g supabase" $YELLOW
    exit 1
fi

print_msg "✅ Supabase CLI encontrado: $(supabase --version)" $GREEN

# Verificar se está logado
print_msg "🔐 Verificando login..." $BLUE
if ! supabase status &> /dev/null; then
    print_msg "❌ Não está logado no Supabase!" $RED
    print_msg "🔐 Faça login com: supabase login" $YELLOW
    exit 1
fi

print_msg "✅ Login verificado" $GREEN

# Verificar se está linkado ao projeto
print_msg "🔗 Verificando link do projeto..." $BLUE
PROJECT_STATUS=$(supabase status 2>/dev/null | grep "Project URL" | grep "kckbcjjgbipcqzkynwpy")

if [ -z "$PROJECT_STATUS" ]; then
    print_msg "❌ Projeto não está linkado!" $RED
    print_msg "🔗 Link com: supabase link --project-ref kckbcjjgbipcqzkynwpy" $YELLOW
    exit 1
fi

print_msg "✅ Projeto linkado" $GREEN

# Deploy da Edge Function
print_msg "📦 Fazendo deploy da Edge Function..." $BLUE
if supabase functions deploy create-profissional; then
    print_msg "✅ Edge Function deployada com sucesso!" $GREEN
else
    print_msg "❌ Erro no deploy da Edge Function!" $RED
    exit 1
fi

# Perguntar sobre as secrets
print_msg "🔑 Deseja configurar as secrets (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY)? (y/n)" $YELLOW
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    print_msg "🔑 Configurando secrets..." $BLUE
    
    # Configurar SUPABASE_URL
    print_msg "🌐 Configurando SUPABASE_URL..." $BLUE
    if supabase secrets set SUPABASE_URL=https://kckbcjjgbipcqzkynwpy.supabase.co; then
        print_msg "✅ SUPABASE_URL configurada" $GREEN
    else
        print_msg "❌ Erro ao configurar SUPABASE_URL" $RED
    fi
    
    # Perguntar pela Service Role Key
    print_msg "🔑 Digite sua SUPABASE_SERVICE_ROLE_KEY:" $YELLOW
    read -s SERVICE_ROLE_KEY
    echo
    
    if supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"; then
        print_msg "✅ SUPABASE_SERVICE_ROLE_KEY configurada" $GREEN
    else
        print_msg "❌ Erro ao configurar SUPABASE_SERVICE_ROLE_KEY" $RED
    fi
fi

# Testar a função
print_msg "🧪 Testando a Edge Function..." $BLUE
FUNCTION_URL="https://kckbcjjgbipcqzkynwpy.supabase.co/functions/v1/create-profissional"
RESPONSE=$(curl -s -w "%{http_code}" "$FUNCTION_URL" | tail -c 3)

if [ "$RESPONSE" = "405" ]; then
    print_msg "✅ Edge Function está ativa! (HTTP 405 - Method not allowed é esperado)" $GREEN
else
    print_msg "⚠️  Resposta inesperada: HTTP $RESPONSE" $YELLOW
    print_msg "🔍 Verifique os logs: supabase functions logs create-profissional" $YELLOW
fi

# Instructions finais
print_msg "🎯 PRÓXIMOS PASSOS:" $BLUE
print_msg "1. Abra: http://localhost:8000/profissionais.html" $WHITE
print_msg "2. Faça login como admin" $WHITE
print_msg "3. Tente criar um profissional" $WHITE
print_msg "4. Verifique se recebe o email de convite" $WHITE

print_msg "📊 Para ver logs: supabase functions logs create-profissional --follow" $BLUE

print_msg "🎉 DEPLOY CONCLUÍDO!" $GREEN
