# 🚀 Instruções de Deploy - Edge Function Atualizada

## 📋 Status

❌ **Edge Function antiga ainda ativa** - Precisa fazer deploy da versão corrigida
❌ **Supabase CLI não instalado** - Precisa instalar primeiro
✅ **Código corrigido** - Versão sem conflito de profile já pronta

## 🔧 Passo 1 - Instalar Supabase CLI

### Via npm (recomendado)
```bash
npm install -g supabase
```

### Verificar instalação
```bash
supabase --version
```

## 🔐 Passo 2 - Fazer Login

```bash
supabase login
```
Isso abrirá o navegador para você fazer login na sua conta Supabase.

## 🔗 Passo 3 - Linkar ao Projeto

```bash
supabase link --project-ref kckbcjjgbipcqzkynwpy
```

## 📦 Passo 4 - Deploy da Edge Function

```bash
supabase functions deploy create-profissional
```

## 🔑 Passo 5 - Configurar Secrets (se ainda não configurou)

```bash
supabase secrets set SUPABASE_URL=https://kckbcjjgbipcqzkynwpy.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui
```

## 🧪 Passo 6 - Verificar Deploy

### Testar URL no navegador
Abra: https://kckbcjjgbipcqzkynwpy.supabase.co/functions/v1/create-profissional

Deve retornar: `{"error":"Method not allowed"}`

### Verificar logs
```bash
supabase functions logs create-profissional
```

## 🎯 Passo 7 - Testar com Email Novo

1. Acesse: http://localhost:8000/profissionais.html
2. Login como admin
3. Novo profissional
4. Use email NOVO (ex: `profissional1@teste.com`)
5. Preencha nome e telefone
6. Salve

## ✅ Resultado Esperado

Após o deploy correto:

```
✅ Profissional criado com sucesso!
✅ Email de convite enviado
✅ Profissional aparece na lista
✅ Sem erro de "duplicate key"
```

## 🐛 Se Ainda Der Erro

Se continuar dando erro de "duplicate key", significa que o deploy não foi feito corretamente. Verifique:

1. **Deploy realmente executou?**
   ```bash
   supabase functions list
   ```

2. **Versão mais recente foi deployada?**
   - Verifique os logs para ver se o código é o corrigido
   - O código corrigido não deve ter "Criar profile" manual

3. **Se necessário, force o deploy:**
   ```bash
   supabase functions deploy create-profissional --no-verify-jwt
   ```

## 🎉 Sucesso!

Após o deploy correto, o fluxo será:

```
Frontend → Edge Function → Criar usuário Auth → Trigger criar profile → Inserir profissional → Sucesso!
```

**Execute estes passos em ordem e o sistema funcionará perfeitamente!**
