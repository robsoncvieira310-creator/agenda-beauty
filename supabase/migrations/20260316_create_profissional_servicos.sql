-- Criar tabela profissional_servicos
-- Relaciona profissionais com serviços e permite personalizar duração/valor

CREATE TABLE IF NOT EXISTS profissional_servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    servico_id UUID NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
    duracao INTEGER NOT NULL, -- Duração personalizada em minutos
    valor DECIMAL(10,2) NOT NULL, -- Valor personalizado
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(profissional_id, servico_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_profissional_servicos_profissional_id ON profissional_servicos(profissional_id);
CREATE INDEX IF NOT EXISTS idx_profissional_servicos_servico_id ON profissional_servicos(servico_id);
CREATE INDEX IF NOT EXISTS idx_profissional_servicos_ativo ON profissional_servicos(ativo);

-- Políticas RLS (Row Level Security)
ALTER TABLE profissional_servicos ENABLE ROW LEVEL SECURITY;

-- Profissionais podem ver seus próprios serviços
CREATE POLICY "Professionals can view their own services" ON profissional_servicos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = profissionais.profile_id 
            AND profiles.id = auth.uid()
        )
    );

-- Profissionais podem inserir seus próprios serviços
CREATE POLICY "Professionals can insert their own services" ON profissional_servicos
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = profissional_id 
            AND profiles.id = auth.uid()
        )
    );

-- Profissionais podem atualizar seus próprios serviços
CREATE POLICY "Professionals can update their own services" ON profissional_servicos
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = profissional_id 
            AND profiles.id = auth.uid()
        )
    );

-- Admins podem tudo
CREATE POLICY "Admins can manage professional services" ON profissional_servicos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );
