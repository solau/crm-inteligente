-- Migração 02: Criação da Tabela de Cashback Ledger e Alertas

CREATE TABLE cashback_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    order_id VARCHAR(100) NOT NULL, -- ID do pedido no Bling
    original_amount NUMERIC(10, 2) NOT NULL, -- Valor original gerado (10% da compra)
    remaining_amount NUMERIC(10, 2) NOT NULL, -- Saldo que ainda não foi usado
    status VARCHAR(50) NOT NULL DEFAULT 'PENDENTE', -- 'PENDENTE', 'ATIVO', 'UTILIZADO', 'EXPIRADO'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Data real da compra
    active_at TIMESTAMP WITH TIME ZONE, -- created_at + 7 dias
    expires_at TIMESTAMP WITH TIME ZONE, -- created_at + 45 dias
    
    CONSTRAINT chk_status CHECK (status IN ('PENDENTE', 'ATIVO', 'UTILIZADO', 'EXPIRADO'))
);

-- Índices para facilitar as consultas FIFO (busca por ATIVOS mais antigos)
CREATE INDEX idx_cashback_ledger_client_status ON cashback_ledger(client_id, status);
CREATE INDEX idx_cashback_ledger_tenant ON cashback_ledger(tenant_id);

-- Tabela para rastrear os Alertas Gerenciais (Ex: Quebra do Capping de 20%)
CREATE TABLE managerial_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    order_id VARCHAR(100) NOT NULL,
    alert_type VARCHAR(100) NOT NULL, -- Ex: 'CAPPING_VIOLATION'
    message TEXT NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
