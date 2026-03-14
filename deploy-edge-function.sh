#!/bin/bash

# Script para deploy da Edge Function create-profissional

echo "🚀 Iniciando deploy da Edge Function create-profissional..."

# Verificar se o Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não encontrado. Instale com: npm install -g supabase"
    exit 1
fi

# Fazer login no Supabase (se necessário)
echo "🔐 Verificando login no Supabase..."
supabase login

# Deploy da Edge Function
echo "📦 Fazendo deploy da Edge Function..."
supabase functions deploy create-profissional

echo "✅ Edge Function deployada com sucesso!"
echo "📧 Email de convite será enviado automaticamente para novos profissionais"
echo "🔗 URL da função: https://<seu-projeto>.supabase.co/functions/v1/create-profissional"
