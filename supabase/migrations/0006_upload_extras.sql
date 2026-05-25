-- Phase 5 upload flow extras:
--   1. Extend media.section_tag CHECK to cover the new pill labels in the
--      upload UI (pit / seated / vip / outside / concourse). The original
--      values (floor / section_100 / section_200 / upper / stage_left /
--      stage_right) remain valid so existing rows aren't affected.
--   2. Add public.event_suggestions for the "Can't find your event?" form.

-- ── 1. section_tag enum widening ─────────────────────────────────────────────
alter table public.media drop constraint if exists media_section_tag_check;
alter table public.media add constraint media_section_tag_check check (
  section_tag is null or section_tag in (
    'floor', 'section_100', 'section_200', 'upper', 'stage_left', 'stage_right',
    'pit', 'seated', 'vip', 'outside', 'concourse'
  )
);

-- ── 2. event_suggestions ─────────────────────────────────────────────────────
create table if not exists public.event_suggestions (
  id             uuid primary key default gen_random_uuid(),
  text           text not null,
  session_token  text,
  created_at     timestamptz not null default now()
);

alter table public.event_suggestions enable row level security;

-- Anonymous + authenticated callers can submit a suggestion. Reads are admin
-- only (handled via service_role from the admin panel later).
drop policy if exists event_suggestions_insert on public.event_suggestions;
create policy event_suggestions_insert on public.event_suggestions
  for insert with check (true);

grant select, insert on public.event_suggestions
  to anon, authenticated, service_role;
