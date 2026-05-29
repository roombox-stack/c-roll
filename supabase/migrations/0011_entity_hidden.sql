-- 0011_entity_hidden.sql
-- Adds a hidden flag to entities so admin can suppress them from the public site
-- without permanently deleting them.

ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;
