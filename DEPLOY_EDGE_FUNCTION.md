# Deploy da Edge Function create-profissional

## 📋 Status Atual

✅ **Edge Function implementada** - `supabase/functions/create-profissional/index.ts`
✅ **Frontend configurado** - `js/dataManager.js` chama a função
✅ **CORS implementado** - Headers completos
❌ **Função não deployada** - Precisa fazer deploy

## 🚀 Passo a Passo para Deploy

### 1. Instalar Supabase CLI

```bash
# Via npm
npm install -g supabase

# Via yarn
yarn global add supabase

# Verificar instalação
supabase --version
```

### 2. Fazer Login no Supabase

```bash
supabase login
```

Isso abrirá o navegador para você fazer login na sua conta Supabase.

### 3. Linkar ao Projeto

```bash
# Se ainda não estiver linkado
supabase link --project-ref kckbcjjgbipcqzkynwpy

# Ou se já estiver linkado, apenas verifique
supabase status
```

### 4. Deploy da Edge Function

```bash
# Deploy da função create-profissional
supabase functions deploy create-profissional

# Ou usar o script que já criamos
chmod +x deploy-edge-function.sh
./deploy-edge-function.sh
```

### 5. Configurar Secrets (Variáveis de Ambiente)

```bash
# Configurar URL do Supabase
supabase secrets set SUPABASE_URL=https://kckbcjjgbipcqzkynwpy.supabase.co

# Configurar Service Role Key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui
```

**Onde encontrar a Service Role Key:**
1. Acesse: https://supabase.com/dashboard/project/kckbcjjgbipcqzkynwpy/settings/api
2. Procure por "service_role" key
3. Copie a chave (começa com `eyJ...`)

## 🔍 Verificação Após Deploy

### 1. Verificar no Dashboard

1. Acesse: https://supabase.com/dashboard/project/kckbcjjgbipcqzkynwpy/functions
2. Procure a função `create-profissional`
3. Status deve estar "Active"

### 2. Testar URL Diretamente

Abra no navegador:
```
https://kckbcjjgbipcqzkynwpy.supabase.co/functions/v1/create-profissional
```

Deve retornar:
```json
{"error":"Method not allowed"}
```

Isso confirma que a função está ativa!

### 3. Testar no Frontend

1. Abra o sistema: http://localhost:8000/profissionais.html
2. Faça login como admin
3. Clique em "Novo Profissional"
4. Preencha os campos e salve
5. Deve funcionar sem erro de CORS!

## 🎯 Fluxo Completo Após Deploy

```
Frontend (Salvar Profissional)
    ↓
Edge Function (POST /functions/v1/create-profissional)
    ↓
Supabase Auth (criar usuário)
    ↓
Trigger (criar profile automaticamente)
    ↓
Edge Function (inserir profissional)
    ↓
Supabase (enviar email de convite)
    ↓
Frontend (sucesso!)
```

## 🐛 Troubleshooting

### Erro: "Function not found"
- Verifique se o deploy foi bem sucedido
- Confirme o nome da função está correto

### Erro: "CORS policy"
- Verifique se os headers CORS estão configurados
- Confirme se a função responde a OPTIONS

### Erro: "Permission denied"
- Verifique se a Service Role Key está correta
- Confirme se as secrets foram configuradas

### Erro: "Database error"
- Verifique se as tabelas `profiles` e `profissionais` existem
- Confirme se o trigger está funcionando

## 📱 Logs da Edge Function

Para ver os logs da função:

```bash
# Ver logs em tempo real
supabase functions logs create-profissional --follow

# Ver logs recentes
supabase functions logs create-profissional
```

## ✅ Checklist Final

- [ ] Supabase CLI instalado
- [ ] Login feito no Supabase
- [ ] Projeto linkado
- [ ] Edge Function deployada
- [ ] Secrets configuradas
- [ ] URL testada (retorna Method not allowed)
- [ ] Frontend testado (cria profissional)
- [ ] Email de convite recebido

## 🎉 Sucesso!

Após o deploy, quando o admin criar um profissional:

1. ✅ Usuário criado no Supabase Auth
2. ✅ Email de convite enviado automaticamente
3. ✅ Profile criado via trigger
4. ✅ Profissional inserido na tabela
5. ✅ Vinculado corretamente via profile_id
6. ✅ Profissional pode fazer login

O sistema estará 100% funcional!
