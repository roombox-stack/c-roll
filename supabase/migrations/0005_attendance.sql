-- Attendance: who-was-where for each show.
--
-- Note: public.users.username and public.users.bio already exist (0001_init).
-- The ADD COLUMN IF NOT EXISTS lines below are defensive — they are no-ops on
-- the current schema but make this migration safe to re-run on fresh databases.

alter table public.users
  add column if not exists username text;

-- Uniqueness was set in 0001_init via `text unique`. Add a named constraint
-- here too (idempotent) so future migrations can reference it.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_username_unique'
  ) then
    alter table public.users add constraint users_username_unique unique (username);
  end if;
exception when duplicate_table then null;
end$$;

alter table public.users
  add column if not exists bio text;

-- ── attended_events ──────────────────────────────────────────────────────────
create table if not exists public.attended_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  event_id     uuid not null references public.events(id) on delete cascade,
  attended_at  timestamptz not null default now(),
  unique (user_id, event_id)
);

create index if not exists attended_events_user_id_idx  on public.attended_events (user_id);
create index if not exists attended_events_event_id_idx on public.attended_events (event_id);

-- Maintain users.show_count via trigger (mirrors how follower/like counters work).
create or replace function public.update_user_show_count()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    update public.users set show_count = show_count + 1 where id = new.user_id;
  elsif (tg_op = 'DELETE') then
    update public.users set show_count = greatest(show_count - 1, 0) where id = old.user_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists attended_events_show_count_trigger on public.attended_events;
create trigger attended_events_show_count_trigger
  after insert or delete on public.attended_events
  for each row execute function public.update_user_show_count();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.attended_events enable row level security;

drop policy if exists attended_events_public_read on public.attended_events;
create policy attended_events_public_read on public.attended_events
  for select using (true);

drop policy if exists attended_events_self_insert on public.attended_events;
create policy attended_events_self_insert on public.attended_events
  for insert with check (auth.uid() = user_id);

drop policy if exists attended_events_self_delete on public.attended_events;
create policy attended_events_self_delete on public.attended_events
  for delete using (auth.uid() = user_id);

-- Grant default schema privileges so PostgREST can see the new table.
grant select, insert, update, delete on public.attended_events
  to anon, authenticated, service_role;
