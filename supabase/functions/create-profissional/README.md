# Edge Function: create-profissional

## Descrição

Edge Function para criar profissionais no sistema Agenda Beauty usando métodos admin do Supabase Auth.

## CORS

A função implementa CORS completo para permitir requisições do frontend:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
```

## Fluxo

1. Recebe dados do profissional (nome, telefone, email, cor)
2. Cria usuário no Supabase Auth usando `auth.admin.createUser()`
3. Cria registro na tabela `profiles`
4. Cria registro na tabela `profissionais`
5. Envia email de convite automaticamente

## Variáveis de Ambiente

- `SUPABASE_URL`: URL do projeto Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key para acesso admin

## Deploy

```bash
supabase functions deploy create-profissional
```

## Uso

```javascript
const response = await fetch(`${supabaseUrl}/functions/v1/create-profissional`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${serviceRoleKey}`,
    'apikey': serviceRoleKey
  },
  body: JSON.stringify({
    nome: 'Nome do Profissional',
    telefone: '(11) 99999-9999',
    email: 'profissional@exemplo.com',
    cor: '#e91e63'
  })
})
```

## Resposta

```json
{
  "success": true,
  "message": "Profissional criado com sucesso! Email de convite enviado.",
  "data": {
    "user": {...},
    "profile": {...},
    "profissional": {...}
  }
}
```

## Debug

A função inclui logs detalhados para debug:

- 🔐 CRIANDO PROFISSIONAL: Dados recebidos
- 🔐 PASSO 1: Criando usuário no Supabase Auth
- 👤 PASSO 2: Criando profile
- 💼 PASSO 3: Criando profissional
- 📧 PASSO 4: Email de convite enviado automaticamente
- 🎉 SUCESSO COMPLETO: Resultado final

## Erros Comuns

### CORS
Se encontrar erro de CORS, verifique:
1. Headers CORS estão definidos corretamente
2. Resposta OPTIONS retorna status 200
3. Todas as respostas incluem headers CORS

### Permissões
Se encontrar erro de permissão, verifique:
1. Service Role Key está correta
2. Variáveis de ambiente configuradas
3. Tabelas existem no banco
