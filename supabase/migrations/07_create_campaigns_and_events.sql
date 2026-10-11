-- 07_create_campaigns_and_events.sql
-- Módulo de Campanhas, Gestão de Eventos Corporativos BPE26, Quiz, Cupons e Promoção
-- IDEMPOTENTE E 100% SEGURO PARA EXECUÇÃO NO SUPABASE SQL EDITOR (NÃO AFETA DADOS EXISTENTES)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Campanhas
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL DEFAULT 'EVENTOS_CORPORATIVOS',
    description TEXT,
    origin VARCHAR(100) DEFAULT 'QR Code e Landing Page',
    commercial_goal TEXT,
    discount_rules JSONB DEFAULT '{"0": 0, "1": 0, "2": 5, "3": 8, "4": 15, "5": 20}'::jsonb,
    regulations TEXT,
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ends_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'ativa' CHECK (status IN ('rascunho', 'ativa', 'pausada', 'encerrada')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_campaigns_tenant_code UNIQUE (tenant_id, code)
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access campaigns of their tenant" ON campaigns;
CREATE POLICY "Users can access campaigns of their tenant" ON campaigns
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_code ON campaigns(code);

-- 2. Tabela de Oportunidades de Eventos Corporativos
CREATE TABLE IF NOT EXISTS event_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(30) NOT NULL,
    contact_email VARCHAR(255),
    contact_role VARCHAR(100),
    segment VARCHAR(100),
    city VARCHAR(100),
    category VARCHAR(50) DEFAULT 'EVENTO',
    guests_range VARCHAR(50),
    instagram VARCHAR(100),
    birth_date VARCHAR(30),
    already_knew_brand VARCHAR(50),
    consent_marketing BOOLEAN DEFAULT false,
    expected_guests INTEGER,
    event_date DATE,
    is_exact_date BOOLEAN DEFAULT false,
    location VARCHAR(255),
    event_type VARCHAR(100) DEFAULT 'confraternizacao_empresarial',
    notes TEXT,
    estimated_value NUMERIC(10,2) DEFAULT 0.00,
    contracted_value NUMERIC(10,2) DEFAULT 0.00,
    origin_channel VARCHAR(100) DEFAULT 'QR Code',
    origin_site VARCHAR(255) DEFAULT 'ChurrascoSalvador.com',
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_content VARCHAR(100),
    utm_term VARCHAR(100),
    consent_commercial BOOLEAN DEFAULT true,
    privacy_terms_version VARCHAR(50) DEFAULT 'v1.0',
    privacy_accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    priority VARCHAR(50) NOT NULL DEFAULT 'EM_NUTRICAO' CHECK (priority IN ('ALTA', 'MEDIA', 'EM_NUTRICAO', 'OUTRAS')),
    stage VARCHAR(50) NOT NULL DEFAULT 'novo_lead' CHECK (stage IN (
        'novo_lead', 
        'contato_realizado', 
        'qualificacao', 
        'orcamento_solicitado', 
        'proposta_enviada', 
        'negociacao', 
        'fechado', 
        'perdido'
    )),
    assigned_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    loss_reason TEXT,
    next_contact_date DATE,
    budget_attachment_url TEXT,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, NOW()) NOT NULL
);

ALTER TABLE event_opportunities ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'EVENTO';
ALTER TABLE event_opportunities ADD COLUMN IF NOT EXISTS guests_range VARCHAR(50);
ALTER TABLE event_opportunities ADD COLUMN IF NOT EXISTS instagram VARCHAR(100);
ALTER TABLE event_opportunities ADD COLUMN IF NOT EXISTS birth_date VARCHAR(30);
ALTER TABLE event_opportunities ADD COLUMN IF NOT EXISTS already_knew_brand VARCHAR(50);
ALTER TABLE event_opportunities ADD COLUMN IF NOT EXISTS consent_marketing BOOLEAN DEFAULT false;

ALTER TABLE event_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access event opportunities of their tenant" ON event_opportunities;
CREATE POLICY "Users can access event opportunities of their tenant" ON event_opportunities
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_event_opportunities_tenant ON event_opportunities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_opportunities_campaign ON event_opportunities(campaign_id);
CREATE INDEX IF NOT EXISTS idx_event_opportunities_client ON event_opportunities(client_id);
CREATE INDEX IF NOT EXISTS idx_event_opportunities_stage ON event_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_event_opportunities_priority ON event_opportunities(priority);
CREATE INDEX IF NOT EXISTS idx_event_opportunities_phone ON event_opportunities(contact_phone);

-- 3. Histórico de Mudanças de Etapa de Eventos
CREATE TABLE IF NOT EXISTS event_stage_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_opportunity_id UUID NOT NULL REFERENCES event_opportunities(id) ON DELETE CASCADE,
    previous_stage VARCHAR(50),
    new_stage VARCHAR(50) NOT NULL,
    changed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, NOW()) NOT NULL
);

ALTER TABLE event_stage_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access event stage history of their tenant" ON event_stage_history;
CREATE POLICY "Users can access event stage history of their tenant" ON event_stage_history
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_event_stage_history_event ON event_stage_history(event_opportunity_id);

-- 4. Perguntas do Quiz
CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    order_num INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    explanation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, NOW()) NOT NULL
);

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access quiz questions of their tenant" ON quiz_questions;
CREATE POLICY "Users can access quiz questions of their tenant" ON quiz_questions
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_quiz_questions_campaign ON quiz_questions(campaign_id);

-- 5. Alternativas do Quiz
CREATE TABLE IF NOT EXISTS quiz_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    letter VARCHAR(2) NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE quiz_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access quiz options" ON quiz_options;
CREATE POLICY "Users can access quiz options" ON quiz_options
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM quiz_questions q 
            WHERE q.id = quiz_options.question_id 
            AND q.tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        )
    );

CREATE INDEX IF NOT EXISTS idx_quiz_options_question ON quiz_options(question_id);

-- 6. Respostas e Submissões do Quiz
CREATE TABLE IF NOT EXISTS quiz_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    event_opportunity_id UUID REFERENCES event_opportunities(id) ON DELETE SET NULL,
    participant_name VARCHAR(255) NOT NULL,
    participant_phone VARCHAR(30) NOT NULL,
    participant_email VARCHAR(255),
    company_name VARCHAR(255),
    answers JSONB NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    coupon_code VARCHAR(50),
    ip_address VARCHAR(50),
    user_agent TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, NOW()) NOT NULL
);

ALTER TABLE quiz_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access quiz submissions of their tenant" ON quiz_submissions;
CREATE POLICY "Users can access quiz submissions of their tenant" ON quiz_submissions
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_quiz_submissions_phone ON quiz_submissions(participant_phone);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_campaign ON quiz_submissions(campaign_id);

-- 7. Tabela de Cupons de Desconto
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    submission_id UUID REFERENCES quiz_submissions(id) ON DELETE SET NULL,
    code VARCHAR(50) NOT NULL,
    discount_percent NUMERIC(5,2) NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, NOW()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'UTILIZADO', 'EXPIRADO', 'CANCELADO')),
    used_at TIMESTAMP WITH TIME ZONE,
    order_id VARCHAR(100),
    min_purchase_value NUMERIC(10,2) DEFAULT 0.00,
    max_discount_value NUMERIC(10,2),
    restrictions TEXT DEFAULT 'Válido exclusivamente para compras de produtos elegíveis da Alpha Bull (cortes nobres). Não cumulativo com outras promoções. Não aplicável a serviços de eventos.',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_coupons_code UNIQUE (code)
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access coupons of their tenant" ON coupons;
CREATE POLICY "Users can access coupons of their tenant" ON coupons
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_client ON coupons(client_id);
CREATE INDEX IF NOT EXISTS idx_coupons_tenant ON coupons(tenant_id);

-- 8. Tabela de Promoção — Cinco Isenções
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    prize_details TEXT DEFAULT 'Isenção do valor correspondente a 5 participantes em uma confraternização empresarial contratada com a Alpha Bull (mínimo de 15 participantes).',
    min_guests INTEGER DEFAULT 15,
    exempt_participants INTEGER DEFAULT 5,
    is_active BOOLEAN DEFAULT false, -- MANDATÓRIO: DESATIVADO POR PADRÃO
    status VARCHAR(50) DEFAULT 'aguardando_autorizacao' CHECK (status IN ('aguardando_autorizacao', 'ativa', 'sorteada', 'encerrada')),
    official_regulations TEXT,
    legal_authorization_code VARCHAR(100),
    winner_event_id UUID REFERENCES event_opportunities(id) ON DELETE SET NULL,
    winner_notes TEXT,
    awarded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_promotions_slug UNIQUE (tenant_id, slug)
);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access promotions of their tenant" ON promotions;
CREATE POLICY "Users can access promotions of their tenant" ON promotions
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_promotions_campaign ON promotions(campaign_id);

-- 9. SEED INICIAL AUTOMÁTICO (Idempotente com ON CONFLICT DO NOTHING)
-- Insere a Campanha BPE26 para o tenant principal Alpha Bull
INSERT INTO campaigns (tenant_id, code, name, type, description, origin, commercial_goal, status)
SELECT 
    id,
    'BPE26',
    'Desafio Alpha Bull — BPE26',
    'Captação de leads para eventos corporativos',
    'Campanha interativa de captação de confraternizações empresariais no Bahia Potência Empresarial 2026 via QR Code e ChurrascoSalvador.com.',
    'QR Code e landing page',
    'Captar empresas interessadas em contratar a Alpha Bull para confraternizações corporativas e eventos de fim de ano.',
    'ativa'
FROM tenants
LIMIT 1
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Insere o registro administrativo da promoção de 5 isenções (DESATIVADA)
INSERT INTO promotions (tenant_id, campaign_id, name, slug, description, min_guests, exempt_participants, is_active, status)
SELECT 
    t.id,
    c.id,
    'Promoção 5 Isenções em Confraternizações',
    'cinco-isencoes',
    'Isenção do valor de 5 participantes para confraternizações contratadas com no mínimo 15 participantes.',
    15,
    5,
    false,
    'aguardando_autorizacao'
FROM tenants t
JOIN campaigns c ON c.tenant_id = t.id AND c.code = 'BPE26'
LIMIT 1
ON CONFLICT (tenant_id, slug) DO NOTHING;
