# 🚀 EXECUTAR MIGRATION - TRIGGER AUTOMÁTICO DE PROFISSIONAIS

## 📋 **O QUE SERÁ EXECUTADO**

### **✅ **MIGRATION CRIADA:**
```
📁 Arquivo: supabase/migrations/20260316_create_profissionais_trigger.sql
🎯 Objetivo: Implementar trigger automático para criar profissionais
📅 Data: 2026-03-16
```

### **✅ **FUNCIONALIDADES:**
1. ✅ Remover coluna `cor` se existir
2. ✅ Garantir estrutura correta da tabela `profissionais`
3. ✅ Criar função `handle_new_profissional()`
4. ✅ Criar trigger `trigger_create_profissional`
5. ✅ Adicionar índices para performance
6. ✅ Atualizar trigger existente de profiles

---

## 🚀 **COMO EXECUTAR**

### **✅ **OPÇÃO 1: SUPABASE DASHBOARD (RECOMENDADO)**

1. **Acessar Dashboard:**
   ```
   https://supabase.com/dashboard/project/kckbcjjgbipcqzkynwpy
   ```

2. **SQL Editor:**
   - No menu lateral, clique em "SQL Editor"
   - Clique em "New query"

3. **Executar Migration:**
   - Copie todo o conteúdo do arquivo `supabase/migrations/20260316_create_profissionais_trigger.sql`
   - Cole no SQL Editor
   - Clique em "Run"

4. **Verificar Resultado:**
   - Deve ver mensagens como:
     ```
     NOTICE: Migration concluída: Trigger automático de profissionais criado com sucesso!
     ```

### **✅ **OPÇÃO 2: SUPABASE CLI**

```bash
# 1. Verificar se está logado
npx supabase login

# 2. Linkar projeto (se ainda não estiver)
npx supabase link --project-ref kckbcjjgbipcqzkynwpy

# 3. Executar migration
npx supabase db push
```

### **✅ **OPÇÃO 3: SUPABASE CLIENT (DIRETO)**

```bash
# Executar migration diretamente
npx supabase db execute --file supabase/migrations/20260316_create_profissionais_trigger.sql
```

---

## 🎯 **O QUE A MIGRATION FAZ**

### **✅ **1. AJUSTA TABELA PROFISSIONAIS:**
```sql
-- Remove coluna 'cor' se existir
ALTER TABLE profissionais DROP COLUMN cor;

-- Garante estrutura correta
CREATE TABLE profissionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    email TEXT NOT NULL,
    cor_calendario TEXT DEFAULT '#8b5cf6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cria FK para profiles
ALTER TABLE profissionais 
ADD CONSTRAINT fk_profissionais_profile_id 
FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
```

### **✅ **2. CRIA FUNÇÃO DO TRIGGER:**
```sql
CREATE OR REPLACE FUNCTION handle_new_profissional()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'profissional' THEN
        INSERT INTO profissionais (
            profile_id, nome, telefone, email, cor_calendario
        ) VALUES (
            NEW.id, NEW.nome, 
            COALESCE(NEW.telefone, ''),
            COALESCE(NEW.email, ''),
            '#e91e63'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### **✅ **3. CRIA TRIGGER:**
```sql
CREATE TRIGGER trigger_create_profissional
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION handle_new_profissional();
```

---

## 🔍 **VERIFICAÇÃO APÓS MIGRATION**

### **✅ **1. VERIFICAR TABELAS:**
```sql
-- Verificar estrutura da tabela profissionais
\d profissionais

-- Verificar se trigger existe
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'trigger_create_profissional';
```

### **✅ **2. VERIFICAR FUNÇÃO:**
```sql
-- Verificar se função foi criada
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'handle_new_profissional';
```

### **✅ **3. VERIFICAR ÍNDICES:**
```sql
-- Verificar índices criados
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename = 'profissionais';
```

---

## 🧪 **TESTE APÓS MIGRATION**

### **✅ **PASSOS PARA TESTAR:**

1. **Acessar Frontend:**
   ```
   http://localhost:8000/profissionais.html
   ```

2. **Login como Admin**

3. **Criar Profissional:**
   - Nome: `Teste Trigger`
   - Telefone: `(11) 99999-9999`
   - Email: `trigger@teste.com` (use email novo!)

4. **Verificar Resultado:**
   - ✅ Profissional criado com sucesso
   - ✅ Sem erro de schema
   - ✅ Sem erro de duplicate key

### **✅ **VERIFICAÇÃO NO BANCO:**
```sql
-- Verificar se usuário foi criado
SELECT * FROM auth.users WHERE email = 'trigger@teste.com';

-- Verificar se profile foi criado
SELECT * FROM profiles WHERE email = 'trigger@teste.com';

-- Verificar se profissional foi criado automaticamente
SELECT * FROM profissionais WHERE email = 'trigger@teste.com';
```

---

## 🎯 **FLUXO FINAL APÓS MIGRATION**

### **✅ **NOVO FLUXO (AUTOMÁTICO):**
```
Frontend → Edge Function → auth.createUser 
    ↓
Trigger auth.users → profiles (com role='profissional')
    ↓
Trigger profiles → profissionais (AUTOMÁTICO)
    ↓
Edge Function busca profissional criado
    ↓
Frontend recebe sucesso
```

### **✅ **VANTAGENS:**
```
✅ Sem inconsistência entre profiles e profissionais
✅ Transação atômica no banco
✅ Menos complexidade na Edge Function
✅ Melhor performance
✅ Mais confiável
```

---

## 🐛 **TROUBLESHOOTING**

### **✅ **SE DER ERRO NA MIGRATION:**
1. **Verificar se tabela já existe:**
   ```sql
   SELECT * FROM information_schema.tables WHERE table_name = 'profissionais';
   ```

2. **Verificar se coluna existe:**
   ```sql
   SELECT * FROM information_schema.columns 
   WHERE table_name = 'profissionais' AND column_name = 'cor';
   ```

3. **Executar manualmente se necessário:**
   - Copie partes específicas da migration
   - Execute uma por vez no SQL Editor

### **✅ **SE O TRIGGER NÃO FUNCIONAR:**
1. **Verificar logs do Supabase:**
   ```
   Dashboard → Settings → Database → Logs
   ```

2. **Testar manualmente:**
   ```sql
   -- Inserir profile manualmente para testar
   INSERT INTO profiles (id, nome, email, telefone, role)
   VALUES ('test-id', 'Teste', 'teste@teste.com', '(11)99999-9999', 'profissional');
   
   -- Verificar se profissional foi criado
   SELECT * FROM profissionais WHERE profile_id = 'test-id';
   ```

---

## 🎉 **RESULTADO ESPERADO**

### **✅ **APÓS MIGRATION BEM-SUCEDIDA:**
```
✅ Trigger automático funcionando
✅ Profissionais criados automaticamente
✅ Sem inconsistência de dados
✅ Edge Function simplificada
✅ Sistema mais robusto
```

**Execute a migration e teste o novo fluxo automático!** 🎯✨
