-- ========================================
-- FIX: CORRIGIR CONFLITO DE MIGRATIONS
-- ========================================

-- Esta migration resolve o conflito da migration duplicada 20260316
-- e garante que o CASCADE esteja aplicado corretamente

DO $$
BEGIN
    RAISE NOTICE 'Aplicando correção de migration duplicada...';
END $$;

-- Garantir que CASCADE esteja aplicado (reaplicar se necessário)
ALTER TABLE profissionais 
DROP CONSTRAINT IF EXISTS profissionais_profile_id_fkey;

ALTER TABLE profissionais 
ADD CONSTRAINT profissionais_profile_id_fkey 
FOREIGN KEY (profile_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

DO $$
BEGIN
    RAISE NOTICE 'CASCADE aplicado com sucesso!';
    RAISE NOTICE 'Correção de migration duplicada concluída!';
END $$;