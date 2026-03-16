-- MIGRATION: Corrigir ON DELETE CASCADE entre profissionais e profiles
-- Versão: 20260316_fix_profissional_profile_cascade
-- Objetivo: Garantir que ao remover profile, profissional também seja removido

-- 1. Remover foreign key atual se existir
DO $$
BEGIN
    -- Verificar se a constraint existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'profissionais_profile_id_fkey' 
        AND table_name = 'profissionais'
    ) THEN
        -- Remover constraint atual
        ALTER TABLE profissionais DROP CONSTRAINT profissionais_profile_id_fkey;
        RAISE NOTICE 'Constraint profissionais_profile_id_fkey removida';
    ELSE
        RAISE NOTICE 'Constraint profissionais_profile_id_fkey não encontrada';
    END IF;
END $$;

-- 2. Adicionar foreign key com ON DELETE CASCADE
ALTER TABLE profissionais 
ADD CONSTRAINT profissionais_profile_id_fkey 
FOREIGN KEY (profile_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

-- 3. Verificar se a constraint foi criada corretamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'profissionais_profile_id_fkey' 
        AND table_name = 'profissionais'
        AND delete_rule = 'CASCADE'
    ) THEN
        RAISE NOTICE '✅ Constraint com ON DELETE CASCADE criada com sucesso';
    ELSE
        RAISE NOTICE '❌ Erro ao criar constraint com ON DELETE CASCADE';
    END IF;
END $$;

-- 4. Verificar relacionamentos existentes
SELECT 
    p.id as profile_id,
    p.nome as profile_nome,
    p.email as profile_email,
    pr.id as profissional_id,
    pr.nome as profissional_nome,
    pr.email as profissional_email
FROM profiles p
LEFT JOIN profissionais pr ON p.id = pr.profile_id
WHERE p.role = 'profissional'
ORDER BY p.created_at DESC;

-- 5. Criar função para exclusão segura de profissional
CREATE OR REPLACE FUNCTION safe_delete_profissional(profissional_id_param INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    profile_id_to_delete UUID;
BEGIN
    -- Buscar profile_id do profissional
    SELECT profile_id INTO profile_id_to_delete
    FROM profissionais
    WHERE id = profissional_id_param;
    
    IF profile_id_to_delete IS NULL THEN
        RAISE EXCEPTION 'Profissional não encontrado';
        RETURN FALSE;
    END IF;
    
    -- Excluir profile (cascade removerá profissional)
    DELETE FROM profiles
    WHERE id = profile_id_to_delete;
    
    RETURN TRUE;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Erro ao excluir profissional: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 6. Criar trigger para garantir consistência (opcional)
CREATE OR REPLACE FUNCTION ensure_profile_consistency()
RETURNS TRIGGER AS $$
BEGIN
    -- Se profile for excluído, este trigger garantirá que profissional também seja
    IF TG_OP = 'DELETE' THEN
        -- O CASCADE já cuidará disso, mas mantemos para logging
        RAISE NOTICE 'Profile % sendo excluído, profissional será removido por CASCADE', OLD.id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 7. Adicionar trigger na tabela profiles (opcional, para logging)
DROP TRIGGER IF EXISTS trigger_ensure_profile_consistency ON profiles;

CREATE TRIGGER trigger_ensure_profile_consistency
    AFTER DELETE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION ensure_profile_consistency();

RAISE NOTICE 'Migration concluída: ON DELETE CASCADE implementado entre profiles e profissionais';
RAISE NOTICE 'Função safe_delete_profissional criada para exclusão segura';
RAISE NOTICE 'Trigger de consistência criado para logging';
