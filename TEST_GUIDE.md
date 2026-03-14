# Guia de Teste - Criação de Profissional

## 🎯 Status Atual

✅ **Edge Function funcionando** - Recebe requisições e processa
✅ **CORS resolvido** - Sem bloqueios
✅ **Conflito com trigger resolvido** - Sem duplicação de profile
❌ **Email já registrado** - Email de teste já foi usado

## 🚀 Como Testar Corretamente

### 1. Deploy da Versão Atualizada

```bash
# Deploy da função com tratamento melhorado de erros
supabase functions deploy create-profissional

# Ou usar o script
chmod +x deploy-updated-function.sh
./deploy-updated-function.sh
```

### 2. Usar Email Diferente

O email `cijem95536@3dkai.com` já foi registrado nos testes anteriores. Use um email novo:

**Sugestões de emails para teste:**
- `profissional1@teste.com`
- `joao.silva@exemplo.com` 
- `maria.beleza@teste.com`
- `teste.profissional@demo.com`

**Ou gere um email aleatório:**
- Visite: https://temp-mail.org/pt/
- Copie um email temporário
- Use no formulário

### 3. Fluxo Completo de Teste

1. **Acessar:** http://localhost:8000/profissionais.html
2. **Login:** Como administrador
3. **Novo Profissional:** Clique no botão
4. **Preencher formulário:**
   - Nome: `João Silva`
   - Telefone: `(11) 99999-9999`
   - Email: `profissional1@teste.com` (use um email novo!)
5. **Salvar:** Clique em "Salvar Profissional"

### 4. Resultado Esperado

✅ **Sucesso:**
```
✅ Profissional criado com sucesso! Email de convite enviado.
✅ Profissional aparece na lista
✅ Email de convite recebido na caixa de entrada
```

❌ **Se usar email repetido:**
```
❌ Este email já está registrado. Use um email diferente.
```

## 🔍 Verificação

### 1. No Supabase Dashboard

1. **Authentication:** Verifique se o usuário foi criado
2. **Profiles:** Verifique se o profile foi criado pelo trigger
3. **Profissionais:** Verifique se o profissional foi inserido

### 2. Logs da Edge Function

```bash
# Ver logs em tempo real
supabase functions logs create-profissional --follow

# Ver logs recentes
supabase functions logs create-profissional
```

### 3. Teste de Login do Profissional

1. **Acessar:** http://localhost:8000/login-profissional.html
2. **Usar:** Email + senha recebida por email
3. **Resultado:** Deve fazer login e redirecionar para agenda

## 🎯 Checklist

- [ ] Edge Function deployada
- [ ] Email novo utilizado
- [ ] Profissional criado com sucesso
- [ ] Email de convite recebido
- [ ] Profissional aparece na lista
- [ ] Login do profissional funciona

## 🐛 Troubleshooting

### Erro: "Email já registrado"
- **Solução:** Use um email diferente
- **Causa:** Email já foi usado em testes anteriores

### Erro: "Function not found"
- **Solução:** Verifique se o deploy foi feito
- **Comando:** `supabase functions deploy create-profissional`

### Erro: "CORS policy"
- **Solução:** Verifique se a função está ativa
- **Teste:** Acesse a URL diretamente no navegador

### Erro: "Permission denied"
- **Solução:** Verifique as secrets configuradas
- **Comando:** `supabase secrets list`

## 🎉 Sucesso!

Após o teste bem-sucedido:

1. ✅ **Usuário criado** no Supabase Auth
2. ✅ **Email enviado** automaticamente
3. ✅ **Profile criado** pelo trigger
4. ✅ **Profissional inserido** na tabela
5. ✅ **Relação correta** entre as tabelas
6. ✅ **Login funcional** para o profissional

O sistema estará 100% operacional!
