// SCRIPT PARA LIMPEZA DE COLUNAS DESNECESSÁRIAS NO SUPABASE
// Execute este script no SQL Editor do Supabase

-- 1. VERIFICAR ESTRUTURA ATUAL DA TABELA
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'agendamentos' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. BACKUP DOS DADOS (SEGURANÇA)
CREATE TABLE agendamentos_backup AS 
SELECT * FROM agendamentos;

-- 3. VERIFICAR SE AS COLUNAS EXISTEM ANTES DE REMOVER
-- (O Supabase PostgreSQL não permite DROP COLUMN se a coluna não existir)

-- 4. REMOVER COLUNAS DESNECESSÁRIAS (SE EXISTIREM)
DO $$
BEGIN
    -- Remover coluna 'data' se existir
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agendamentos' 
        AND column_name = 'data'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE agendamentos DROP COLUMN IF EXISTS data;
        RAISE NOTICE 'Coluna "data" removida';
    END IF;

    -- Remover coluna 'hora' se existir
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agendamentos' 
        AND column_name = 'hora'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE agendamentos DROP COLUMN IF EXISTS hora;
        RAISE NOTICE 'Coluna "hora" removida';
    END IF;

    -- Remover coluna 'hora_inicio' se existir
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agendamentos' 
        AND column_name = 'hora_inicio'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE agendamentos DROP COLUMN IF EXISTS hora_inicio;
        RAISE NOTICE 'Coluna "hora_inicio" removida';
    END IF;

    -- Remover coluna 'hora_fim' se existir
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agendamentos' 
        AND column_name = 'hora_fim'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE agendamentos DROP COLUMN IF EXISTS hora_fim;
        RAISE NOTICE 'Coluna "hora_fim" removida';
    END IF;

    -- Remover coluna 'profissional' se existir
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agendamentos' 
        AND column_name = 'profissional'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE agendamentos DROP COLUMN IF EXISTS profissional;
        RAISE NOTICE 'Coluna "profissional" removida';
    END IF;

    -- Remover coluna 'dia' se existir
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agendamentos' 
        AND column_name = 'dia'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE agendamentos DROP COLUMN IF EXISTS dia;
        RAISE NOTICE 'Coluna "dia" removida';
    END IF;
END $$;

-- 5. VERIFICAR ESTRUTURA FINAL
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'agendamentos' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. VERIFICAR DADOS APÓS LIMPEZA
SELECT * FROM agendamentos LIMIT 5;

-- 7. ESTRUTURA ESPERADA (SÓ COLUNAS NECESSÁRIAS):
-- - id (bigint, primary key)
-- - cliente_id (bigint)
-- - servico_id (bigint)  
-- - profissional_id (bigint)
-- - data_inicio (timestamp)
-- - data_fim (timestamp)
-- - status (text)
-- - observacoes (text)
-- - created_at (timestamp)
-- - updated_at (timestamp)

RAISE NOTICE '✅ Limpeza de colunas concluída com sucesso!';
