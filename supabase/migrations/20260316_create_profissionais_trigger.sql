-- MIGRATION: Criar trigger automático para profissionais
-- Versão: 20260316
-- Descrição: Remove criação manual de profissional da Edge Function
--           e implementa trigger automático no banco

-- 1. Verificar e ajustar tabela profissionais
-- Garantir que não tenha coluna 'cor' (usar 'cor_calendario' se necessário)

-- Remover coluna 'cor' se existir
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='profissionais' 
        AND column_name='cor'
    ) THEN
        ALTER TABLE profissionais DROP COLUMN cor;
        RAISE NOTICE 'Coluna "cor" removida da tabela profissionais';
    END IF;
END $$;

-- Garantir estrutura correta da tabela profissionais
DO $$
BEGIN
    -- Criar tabela se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profissionais') THEN
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
        
        -- Criar FK para profiles
        ALTER TABLE profissionais 
        ADD CONSTRAINT fk_profissionais_profile_id 
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Tabela profissionais criada com estrutura correta';
    ELSE
        -- Verificar e adicionar colunas se faltando
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='profissionais' AND column_name='cor_calendario'
        ) THEN
            ALTER TABLE profissionais ADD COLUMN cor_calendario TEXT DEFAULT '#8b5cf6';
            RAISE NOTICE 'Coluna cor_calendario adicionada';
        END IF;
        
        -- Verificar FK
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name='profissionais' AND constraint_name='fk_profissionais_profile_id'
        ) THEN
            ALTER TABLE profissionais 
            ADD CONSTRAINT fk_profissionais_profile_id 
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
            RAISE NOTICE 'FK fk_profissionais_profile_id adicionada';
        END IF;
    END IF;
END $$;

-- 2. Criar função handle_new_profissional()
CREATE OR REPLACE FUNCTION handle_new_profissional()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o novo profile for um profissional, criar registro automaticamente
    IF NEW.role = 'profissional' THEN
        INSERT INTO profissionais (
            profile_id,
            nome,
            telefone,
            email,
            cor_calendario
        ) VALUES (
            NEW.id,
            NEW.nome,
            COALESCE(NEW.telefone, ''),
            COALESCE(NEW.email, ''),
            '#e91e63'  -- Cor padrão para novos profissionais
        );
        
        RAISE NOTICE 'Profissional criado automaticamente para profile_id: %', NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Criar trigger para executar a função
DROP TRIGGER IF EXISTS trigger_create_profissional ON profiles;
CREATE TRIGGER trigger_create_profissional
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION handle_new_profissional();

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_profissionais_profile_id ON profissionais(profile_id);
CREATE INDEX IF NOT EXISTS idx_profissionais_email ON profissionais(email);

-- 5. Adicionar colunas na tabela profiles se não existirem
DO $$
BEGIN
    -- Adicionar coluna telefone se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='profiles' AND column_name='telefone'
    ) THEN
        ALTER TABLE profiles ADD COLUMN telefone TEXT;
        RAISE NOTICE 'Coluna telefone adicionada à tabela profiles';
    END IF;
    
    -- Adicionar coluna email se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='profiles' AND column_name='email'
    ) THEN
        ALTER TABLE profiles ADD COLUMN email TEXT;
        RAISE NOTICE 'Coluna email adicionada à tabela profiles';
    END IF;
END $$;

-- 6. Atualizar trigger existente de profiles para popular os novos campos
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, nome, email, telefone, role)
    SELECT 
        id,
        raw_user_meta_data->>'nome',
        email,
        raw_user_meta_data->>'telefone',
        raw_user_meta_data->>'role'
    FROM auth.users
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Limpar triggers antigos
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Criar trigger correto
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();

RAISE NOTICE 'Migration concluída: Trigger automático de profissionais criado com sucesso!';
