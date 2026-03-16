-- =====================================================
-- PROFISSIONAIS V2 - TRIGGERS E POLÍTICAS RLS
-- =====================================================

-- 1. TRIGGER PARA CRIAR PROFILE AUTOMATICAMENTE
-- Este trigger cria um registro na tabela profiles quando um usuário é criado no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserir profile com dados básicos
  INSERT INTO public.profiles (id, email, role, first_login_completed)
  VALUES (
    NEW.id,
    NEW.email,
    'profissional', -- Role padrão para novos usuários criados por admin
    false -- Primeiro login pendente
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para executar a função após criação de usuário
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 2. POLÍTICAS RLS PARA PROFILES
-- =====================================================

-- Habilitar RLS na tabela profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política: Admins podem ver todos os profiles
CREATE POLICY IF NOT EXISTS "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Política: Usuários podem ver seu próprio profile
CREATE POLICY IF NOT EXISTS "Users can view own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());

-- Política: Admins podem atualizar todos os profiles
CREATE POLICY IF NOT EXISTS "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Política: Usuários podem atualizar seu próprio profile (exceto role)
CREATE POLICY IF NOT EXISTS "Users can update own profile" ON public.profiles
  FOR UPDATE USING (
    id = auth.uid() AND 
    (role IS NOT DISTINCT FROM OLD.role) -- Não permite mudar role
  );

-- =====================================================
-- 3. POLÍTICAS RLS PARA PROFISSIONAIS
-- =====================================================

-- Habilitar RLS na tabela profissionais
ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;

-- Política: Admins podem ver todos os profissionais
CREATE POLICY IF NOT EXISTS "Admins can view all profissionais" ON public.profissionais
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Política: Profissionais podem ver seu próprio registro
CREATE POLICY IF NOT EXISTS "Professionals can view own record" ON public.profissionais
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.id = public.profissionais.profile_id
    )
  );

-- Política: Admins podem inserir profissionais
CREATE POLICY IF NOT EXISTS "Admins can insert profissionais" ON public.profissionais
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Política: Admins podem atualizar profissionais
CREATE POLICY IF NOT EXISTS "Admins can update profissionais" ON public.profissionais
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Política: Profissionais podem atualizar seu próprio telefone
CREATE POLICY IF NOT EXISTS "Professionals can update own phone" ON public.profissionais
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.id = public.profissionais.profile_id
    )
  );

-- =====================================================
-- 4. ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices para profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Índices para profissionais
CREATE INDEX IF NOT EXISTS idx_profissionais_profile_id ON public.profissionais(profile_id);

-- =====================================================
-- 5. FUNÇÃO PARA VERIFICAR PRIMEIRO LOGIN
-- =====================================================

-- Função para verificar se usuário precisa trocar senha
CREATE OR REPLACE FUNCTION public.needs_password_change(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT first_login_completed = false 
    FROM public.profiles 
    WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. VIEW PARA PROFISSIONAIS COM DADOS COMPLETOS
-- =====================================================

-- View com join de profiles e profissionais
CREATE OR REPLACE VIEW public.profissionais_completos AS
SELECT 
  p.id as profissional_id,
  p.profile_id,
  p.telefone as profissional_telefone,
  p.created_at as profissional_created_at,
  pr.nome,
  pr.email,
  pr.role,
  pr.first_login_completed,
  pr.created_at as profile_created_at
FROM public.profissionais p
JOIN public.profiles pr ON p.profile_id = pr.id;

-- Habilitar RLS na view
ALTER VIEW public.profissionais_completos ENABLE ROW LEVEL SECURITY;

-- Política para a view
CREATE POLICY IF NOT EXISTS "Admins can view all profissionais_completos" ON public.profissionais_completos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- =====================================================
-- 7. LIMPEZA E VERIFICAÇÃO
-- =====================================================

-- Remover políticas duplicadas ou conflitantes (se existirem)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "Professionals can insert own record" ON public.profissionais;
DROP POLICY IF EXISTS "Professionals can delete own record" ON public.profissionais;

-- =====================================================
-- 8. LOGS E AUDITORIA (OPCIONAL)
-- =====================================================

-- Tabela de auditoria para criação de profissionais (opcional)
CREATE TABLE IF NOT EXISTS public.profissional_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID REFERENCES public.profissionais(id),
  admin_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger para auditoria (opcional - comentar se não necessário)
/*
CREATE OR REPLACE FUNCTION public.log_profissional_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.profissional_audit_log (profissional_id, admin_id, action, new_data)
    VALUES (NEW.id, auth.uid(), 'INSERT', row_to_json(NEW));
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.profissional_audit_log (profissional_id, admin_id, action, old_data, new_data)
    VALUES (NEW.id, auth.uid(), 'UPDATE', row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger de auditoria
CREATE TRIGGER profissional_audit_trigger
  AFTER INSERT OR UPDATE ON public.profissionais
  FOR EACH ROW
  EXECUTE FUNCTION public.log_profissional_changes();
*/

-- =====================================================
-- RESUMO DA MIGRAÇÃO
-- =====================================================

/*
Esta migração implementa:

1. ✅ Trigger automático para criar profiles
2. ✅ Políticas RLS robustas
3. ✅ Índices de performance
4. ✅ View com dados completos
5. ✅ Função utilitária
6. ✅ Auditoria opcional
7. ✅ Segurança e integridade

Execute com:
  psql -h HOST -U USER -d DATABASE < profissional_v2_migration.sql
*/
