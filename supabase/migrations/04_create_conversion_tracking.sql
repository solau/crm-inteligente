-- Migração 04: Rastreamento de Conversões e Interações

-- 1. Tabela de Interações (Registra cliques no WhatsApp do Kanban)
CREATE TABLE client_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    campaign_type VARCHAR(100) NOT NULL, -- Ex: 'CASHBACK_10D', 'OFERTA_90D', 'POS_VENDA'
    user_id UUID REFERENCES user_profiles(id), -- Quem enviou a msg (pode ser null se for bot no futuro)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE client_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access interactions in same tenant" ON client_interactions
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

-- Índices de performance
CREATE INDEX idx_client_interactions_client ON client_interactions(client_id);
CREATE INDEX idx_client_interactions_tenant ON client_interactions(tenant_id);

-- 2. Tabela de Atribuição de Vendas (Liga a venda a uma interação)
CREATE TABLE sales_attribution (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    interaction_id UUID NOT NULL REFERENCES client_interactions(id) ON DELETE CASCADE,
    order_id VARCHAR(100) NOT NULL, -- ID do pedido no Bling
    revenue NUMERIC(10, 2) NOT NULL, -- Valor da venda
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE sales_attribution ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access sales_attribution in same tenant" ON sales_attribution
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE INDEX idx_sales_attribution_tenant ON sales_attribution(tenant_id);

-- 3. View de Dashboard de Conversão (Agrega Vendas por Campanha)
CREATE OR REPLACE VIEW vw_kanban_dashboard AS
SELECT 
    ci.tenant_id,
    ci.campaign_type,
    DATE_TRUNC('month', ci.created_at) as month,
    COUNT(ci.id) as total_interactions,
    COUNT(sa.id) as total_conversions,
    COALESCE(SUM(sa.revenue), 0) as total_revenue,
    CASE 
        WHEN COUNT(ci.id) > 0 THEN ROUND((COUNT(sa.id)::numeric / COUNT(ci.id)::numeric) * 100, 2)
        ELSE 0 
    END as conversion_rate
FROM client_interactions ci
LEFT JOIN sales_attribution sa ON sa.interaction_id = ci.id
GROUP BY ci.tenant_id, ci.campaign_type, DATE_TRUNC('month', ci.created_at);
