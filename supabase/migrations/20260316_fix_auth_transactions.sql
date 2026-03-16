-- MIGRATION: Corrigir arquitetura de criação de usuários e profissionais
-- Versão: 20260316_fix_auth_transactions
-- Objetivo: Remover trigger de profissionais durante auth.createUser para evitar falhas de transação

-- 1. Remover trigger e função que criam profissionais automaticamente
-- Isso evita falhas de transação durante auth.createUser

DROP TRIGGER IF EXISTS on_profile_created_profissional ON profiles;
DROP TRIGGER IF EXISTS trigger_create_profissional ON profiles;

DROP FUNCTION IF EXISTS handle_new_profissional();

RAISE NOTICE 'Trigger e função de profissionais removidos para evitar falhas de transação';

-- 2. Garantir estrutura correta da tabela profiles
DO $$
BEGIN
    -- Criar tabela profiles se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        CREATE TABLE profiles (
            id UUID PRIMARY KEY,
            nome TEXT,
            email TEXT,
            telefone TEXT,
            role TEXT DEFAULT 'cliente',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        RAISE NOTICE 'Tabela profiles criada';
    ELSE
        -- Verificar e adicionar colunas se faltando
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='profiles' AND column_name='telefone'
        ) THEN
            ALTER TABLE profiles ADD COLUMN telefone TEXT;
            RAISE NOTICE 'Coluna telefone adicionada à tabela profiles';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='profiles' AND column_name='role'
        ) THEN
            ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'cliente';
            RAISE NOTICE 'Coluna role adicionada à tabela profiles';
        END IF;
    END IF;
END $$;

-- 3. Garantir estrutura correta da tabela profissionais
DO $$
BEGIN
    -- Criar tabela profissionais se não existir
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
        
        -- Criar índice único para impedir mais de um profissional por profile
        CREATE UNIQUE INDEX idx_profissionais_profile_id_unique ON profissionais(profile_id);
        
        -- Criar índices para performance
        CREATE INDEX idx_profissionais_email ON profissionais(email);
        
        RAISE NOTICE 'Tabela profissionais criada com estrutura correta';
    ELSE
        -- Verificar e adicionar índice único se não existir
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'profissionais' 
            AND indexname = 'idx_profissionais_profile_id_unique'
        ) THEN
            CREATE UNIQUE INDEX idx_profissionais_profile_id_unique ON profissionais(profile_id);
            RAISE NOTICE 'Índice único para profile_id criado';
        END IF;
        
        -- Verificar FK se não existir
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

-- 4. Criar função simplificada para criar apenas profiles
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

-- 5. Criar trigger apenas para profiles (sem criar profissionais)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();

-- 6. Habilitar Row Level Security para profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 7. Criar políticas de segurança para profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- 8. Habilitar Row Level Security para profissionais
ALTER TABLE profissionais ENABLE ROW LEVEL SECURITY;

-- 9. Criar políticas de segurança para profissionais
DROP POLICY IF EXISTS "Professionals can view their own data" ON profissionais;
DROP POLICY IF EXISTS "Professionals can update their own data" ON profissionais;
DROP POLICY IF EXISTS "Admins can view all professionals" ON profissionais;
DROP POLICY IF EXISTS "Admins can insert professionals" ON profissionais;
DROP POLICY IF EXISTS "Admins can update all professionals" ON profissionais;

CREATE POLICY "Professionals can view their own data" ON profissionais
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = profissionais.profile_id 
            AND profiles.id = auth.uid()
        )
    );

CREATE POLICY "Professionals can update their own data" ON profissionais
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = profissionais.profile_id 
            AND profiles.id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all professionals" ON profissionais
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert professionals" ON profissionais
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can update all professionals" ON profissionais
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

RAISE NOTICE 'Migration concluída: Arquitetura corrigida para evitar falhas de transação!';
RAISE NOTICE 'Fluxo: auth.users → profiles (trigger) → profissionais (Edge Function)';
