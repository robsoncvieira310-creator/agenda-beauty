-- Migration: Criar VIEW profissionais_view para compatibilidade
-- Versão: 1.0.0
-- Objetivo: Manter compatibilidade com código existente

-- Criar view para compatibilidade
CREATE OR REPLACE VIEW profissionais_view AS
SELECT 
    p.id,
    p.telefone,
    p.created_at,
    pr.nome,
    pr.email,
    pr.role
FROM profissionais p
JOIN profiles pr ON p.profile_id = pr.id;

-- Comentários
COMMENT ON VIEW profissionais_view IS 'View compatível com dados completos de profissionais';
COMMENT ON COLUMN profissionais_view.id IS 'ID do profissional';
COMMENT ON COLUMN profissionais_view.telefone IS 'Telefone do profissional';
COMMENT ON COLUMN profissionais_view.nome IS 'Nome do profissional (do profile)';
COMMENT ON COLUMN profissionais_view.email IS 'Email do profissional (do profile)';
COMMENT ON COLUMN profissionais_view.role IS 'Função do usuário (do profile)';
