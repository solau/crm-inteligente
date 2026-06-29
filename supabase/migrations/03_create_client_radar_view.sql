-- 03_create_client_radar_view.sql
CREATE OR REPLACE VIEW vw_client_radar AS
SELECT 
    c.id, c.tenant_id, c.name, c.phone, c.lead_score, c.cashback_balance, c.last_purchase_date,
    (SELECT min(expires_at) FROM cashback_ledger l WHERE l.client_id = c.id AND l.status = 'ATIVO' AND l.remaining_amount > 0) as next_expire_date,
    (SELECT max(expires_at) FROM cashback_ledger l WHERE l.client_id = c.id AND l.status = 'EXPIRADO') as last_expired_date,
    COALESCE((SELECT remaining_amount FROM cashback_ledger l WHERE l.client_id = c.id AND l.status = 'EXPIRADO' ORDER BY expires_at DESC LIMIT 1), 0) as total_expired_amount,
    EXISTS (SELECT 1 FROM cashback_ledger l WHERE l.client_id = c.id AND l.status = 'ATIVO' AND l.remaining_amount > 0) as has_active,
    EXISTS (SELECT 1 FROM cashback_ledger l WHERE l.client_id = c.id AND l.status = 'EXPIRADO') as has_expired
FROM clients c;
