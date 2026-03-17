-- Migration: Criar tabela profissional_servicos
-- Versão: 1.0.0
-- Objetivo: Vincular serviços a profissionais

-- Criar tabela profissional_servicos
CREATE TABLE IF NOT EXISTS profissional_servicos (
    id SERIAL PRIMARY KEY,
    profissional_id UUID REFERENCES profissionais(id) ON DELETE CASCADE,
    servico_id UUID REFERENCES servicos(id) ON DELETE CASCADE,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(profissional_id, servico_id)
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_profissional_servicos_profissional_id ON profissional_servicos(profissional_id);
CREATE INDEX IF NOT EXISTS idx_profissional_servicos_servico_id ON profissional_servicos(servico_id);
CREATE INDEX IF NOT EXISTS idx_profissional_servicos_ativo ON profissional_servicos(ativo);

-- Inserir dados iniciais (todos os profissionais para todos os serviços)
INSERT INTO profissional_servicos (profissional_id, servico_id)
SELECT p.id, s.id
FROM profissionais p
CROSS JOIN servicos s
WHERE s.ativo = true
ON CONFLICT (profissional_id, servico_id) DO NOTHING;

-- Criar view para compatibilidade
CREATE OR REPLACE VIEW profissionais_view AS
SELECT 
    p.id,
    p.telefone,
    pr.nome,
    pr.email,
    pr.role,
    p.created_at
FROM profissionais p
JOIN profiles pr ON p.profile_id = pr.id;

-- Comentários
COMMENT ON TABLE profissional_servicos IS 'Vincula serviços a profissionais';
COMMENT ON COLUMN profissional_servicos.profissional_id IS 'ID do profissional';
COMMENT ON COLUMN profissional_servicos.servico_id IS 'ID do serviço';
COMMENT ON COLUMN profissional_servicos.ativo IS 'Se o vínculo está ativo';
COMMENT ON VIEW profissionais_view IS 'View compatível com dados completos de profissionais';
