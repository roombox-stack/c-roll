-- Make media.event_id nullable so entity-level clips (e.g. hero grid uploads
-- not tied to a specific show) can exist without an event association.
-- Change the FK action from CASCADE to SET NULL so deleting an event doesn't
-- remove the media row — it just clears the event reference.

alter table public.media
  alter column event_id drop not null;

alter table public.media
  drop constraint if exists media_event_id_fkey;

alter table public.media
  add constraint media_event_id_fkey
    foreign key (event_id)
    references public.events(id)
    on delete set null;
