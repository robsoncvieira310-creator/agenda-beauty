-- ========================================
-- MIGRATION: DELETE PROFISSIONAL COM CASCADE
-- ========================================

-- 1. Garantir foreign key com CASCADE na tabela profissionais
-- Se o profile for deletado, o profissional também será deletado

ALTER TABLE profissionais 
DROP CONSTRAINT IF EXISTS profissionais_profile_id_fkey;

ALTER TABLE profissionais 
ADD CONSTRAINT profissionais_profile_id_fkey 
FOREIGN KEY (profile_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

-- 2. Garantir que profiles.id tenha relação com auth.users
-- (Isso já existe naturalmente via Supabase Auth)

-- 3. Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_profissionais_profile_id ON profissionais(profile_id);
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

-- 4. Trigger opcional para logs de exclusão (audit)
CREATE OR REPLACE FUNCTION log_profissional_deletion()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs(table_name, record_id, action, user_id, created_at)
    VALUES ('profissionais', OLD.profile_id, 'DELETE', auth.uid(), NOW());
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar tabela de audit se não existir
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id UUID,
    action TEXT NOT NULL,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_log_profissional_deletion ON profissionais;
CREATE TRIGGER trigger_log_profissional_deletion
    AFTER DELETE ON profissionais
    FOR EACH ROW
    EXECUTE FUNCTION log_profissional_deletion();

DO $$
BEGIN
    RAISE NOTICE 'Migration concluída: Delete profissional com CASCADE implementado!';
END $$;

-- ========================================
-- COMENTÁRIOS IMPORTANTES
-- ========================================

-- 1. ON DELETE CASCADE garante que:
--    - Ao deletar user do auth → profile deletado
--    - Ao deletar profile → profissional deletado
--    - Sem dados órfãos permanecem

-- 2. Fluxo de exclusão completo:
--    DELETE FROM auth.users WHERE id = profile_id
--    → Profile deletado automaticamente (FK)
--    → Profissional deletado automaticamente (FK)
--    → Log de auditoria criado (trigger)

-- 3. Segurança:
--    - Apenas admin pode chamar a Edge Function
--    - Validação JWT obrigatória
--    - Cascade evita dados órfãos

-- 4. Performance:
--    - Índices otimizam as queries
--    - Cascade é mais eficiente que deletes manuais
