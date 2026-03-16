-- MIGRATION: Adicionar campo first_login_completed
-- Versão: 20260316_add_first_login_field
-- Objetivo: Implementar fluxo de primeiro acesso para profissionais

-- 1. Adicionar campo first_login_completed na tabela profiles
DO $$
BEGIN
    -- Verificar se a coluna já existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='profiles' AND column_name='first_login_completed'
    ) THEN
        ALTER TABLE profiles ADD COLUMN first_login_completed BOOLEAN DEFAULT FALSE;
        
        -- Criar índice para performance
        CREATE INDEX idx_profiles_first_login ON profiles(first_login_completed);
        
        RAISE NOTICE 'Campo first_login_completed adicionado à tabela profiles';
    ELSE
        RAISE NOTICE 'Campo first_login_completed já existe na tabela profiles';
    END IF;
END $$;

-- 2. Criar função para marcar primeiro login
CREATE OR REPLACE FUNCTION mark_first_login()
RETURNS BOOLEAN AS $$
BEGIN
    -- Atualizar o profile do usuário atual
    UPDATE profiles 
    SET first_login_completed = TRUE 
    WHERE id = auth.uid();
    
    -- Verificar se atualização foi bem-sucedida
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Garantir que a tabela profiles tenha todos os campos necessários
DO $$
BEGIN
    -- Verificar e adicionar coluna email se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='profiles' AND column_name='email'
    ) THEN
        ALTER TABLE profiles ADD COLUMN email TEXT;
        RAISE NOTICE 'Campo email adicionado à tabela profiles';
    END IF;
    
    -- Verificar e adicionar coluna telefone se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='profiles' AND column_name='telefone'
    ) THEN
        ALTER TABLE profiles ADD COLUMN telefone TEXT;
        RAISE NOTICE 'Campo telefone adicionado à tabela profiles';
    END IF;
END $$;

-- 4. Atualizar trigger para incluir novos campos
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, nome, email, telefone, role, first_login_completed)
    SELECT 
        id,
        raw_user_meta_data->>'nome',
        email,
        raw_user_meta_data->>'telefone',
        raw_user_meta_data->>'role',
        FALSE  -- Primeiro login não completado
    FROM auth.users
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar política para permitir que usuários atualizem seu próprio first_login_completed
DROP POLICY IF EXISTS "Users can update their first login" ON profiles;

CREATE POLICY "Users can update their first login" ON profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 6. Habilitar Row Level Security se não estiver habilitado
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

RAISE NOTICE 'Migration concluída: Fluxo de primeiro acesso implementado!';
RAISE NOTICE 'Função mark_first_login() criada e pronta para uso';
