-- =====================================================
-- CORREÇÃO DO SCHEMA - ADICIONAR COLUNA EMAIL
-- =====================================================

-- Verificar se a coluna email existe na tabela profissionais
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profissionais' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Se não existir, adicionar a coluna
-- ALTER TABLE public.profissionais ADD COLUMN email TEXT;

-- =====================================================
-- INSTRUÇÕES:
-- 1. Execute este SELECT para verificar as colunas
-- 2. Se a coluna 'email' não existir, execute o ALTER TABLE
-- 3. Re-deploy a Edge Function create-professional
-- =====================================================
