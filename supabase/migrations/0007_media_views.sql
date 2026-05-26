-- Phase 6.1 view-count dedup.
--
-- Stops the old "+1 per page load" behavior. We log one row per
-- (media_id, session_token) and only bump media.view_count on the first
-- insert. Same shape as the partial-unique-on-likes pattern in 0001_init.

create table if not exists public.media_views (
  id             uuid primary key default gen_random_uuid(),
  media_id       uuid not null references public.media(id) on delete cascade,
  session_token  text not null,
  viewed_at      timestamptz not null default now(),
  unique (media_id, session_token)
);

create index if not exists media_views_media_id_idx on public.media_views (media_id);

-- view_count is maintained by an after-insert trigger so the bump happens
-- in the same transaction as the row insert. No bump on delete — once a
-- view is counted, it stays counted.
create or replace function public.update_media_view_count()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    update public.media set view_count = view_count + 1 where id = new.media_id;
  end if;
  return new;
end;
$$;

drop trigger if exists media_views_count_trigger on public.media_views;
create trigger media_views_count_trigger
  after insert on public.media_views
  for each row execute function public.update_media_view_count();

-- RLS: inserts only via the service role (POST /api/view). No public read.
alter table public.media_views enable row level security;

drop policy if exists media_views_no_read on public.media_views;
-- Intentionally no select policy → anon/authenticated cannot read.

grant select, insert on public.media_views to service_role;
