-- Remove the foreign key constraint
ALTER TABLE client_interactions DROP CONSTRAINT IF EXISTS client_interactions_user_id_fkey;

-- Change the column type from UUID to VARCHAR
ALTER TABLE client_interactions ALTER COLUMN user_id TYPE VARCHAR(255);
