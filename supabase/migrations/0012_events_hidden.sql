-- 0012_events_hidden.sql
-- Adds a hidden flag to events that cascades from the parent entity.
-- When an entity is hidden, all its events are also hidden from the public site.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: hide events for any currently-hidden entity.
UPDATE events
SET hidden = TRUE
FROM entities
WHERE events.entity_id = entities.id
  AND entities.hidden = TRUE;

-- Trigger: when entities.hidden changes, sync all child events.
CREATE OR REPLACE FUNCTION sync_events_hidden()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.hidden IS DISTINCT FROM OLD.hidden THEN
    UPDATE events
    SET hidden = NEW.hidden
    WHERE entity_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_events_hidden ON entities;
CREATE TRIGGER trg_sync_events_hidden
  AFTER UPDATE OF hidden ON entities
  FOR EACH ROW EXECUTE FUNCTION sync_events_hidden();

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.events TO anon, authenticated;
