-- Adiciona colunas para controle da Matriz RFM
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS last_purchase_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS total_spent NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS base_lead_score INTEGER DEFAULT 0;
