-- Add a pinned hero-grid media list to entities.
-- Stores up to 6 media UUIDs in order. When non-null and non-empty,
-- the entity page uses these instead of the auto-selected clips.

alter table public.entities
  add column if not exists hero_media_ids uuid[] default null;
