-- Migration para adicionar restrição única no order_id

ALTER TABLE cashback_ledger
ADD CONSTRAINT unique_order_id UNIQUE (order_id, tenant_id);
