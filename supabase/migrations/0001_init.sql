-- Showside V1 initial schema.
-- Apply via Supabase dashboard → SQL editor, or `supabase db push` if the CLI is linked.
--
-- The auth.users trigger and counter triggers all require the role that runs
-- this script to have permission to create triggers on auth schema. The Supabase
-- dashboard SQL editor runs as the postgres role and is fine.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- entities: artists, teams, event brands, venues
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.entities (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  type            text not null check (type in ('artist','team','event_brand','venue')),
  genre           text,
  bio             text,
  verified        boolean not null default false,
  claimed         boolean not null default false,
  hero_image_url  text,
  follower_count  integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- events: a specific show / game / festival date
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.events (
  id              uuid primary key default gen_random_uuid(),
  entity_id       uuid not null references public.entities(id) on delete cascade,
  slug            text not null,
  name            text not null,
  venue_name      text not null,
  city            text not null,
  state           text,
  country         text not null default 'US',
  event_date      date not null,
  tour_name       text,
  setlist         jsonb,
  external_id     text,
  upload_count    integer not null default 0,
  photo_count     integer not null default 0,
  video_count     integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (entity_id, event_date, slug)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- users: app-level profile, mirrors auth.users via trigger below
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique,
  display_name    text,
  avatar_url      text,
  upload_count    integer not null default 0,
  show_count      integer not null default 0,
  bio             text,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- media: photos and videos uploaded by fans
-- Status flow:
--   uploading       — presigned URL issued, awaiting client upload + completion
--   active          — visible to public
--   pending_review  — admin queue
--   removed         — moderated out / soft-deleted
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.media (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  entity_id       uuid not null references public.entities(id) on delete cascade,
  uploader_id     uuid references public.users(id) on delete set null,
  upload_session  text,
  file_type       text not null check (file_type in ('photo','video')),
  storage_url     text not null,
  mux_asset_id    text,
  mux_upload_id   text,
  mux_playback_id text,
  thumbnail_url   text,
  duration_sec    integer,
  song_tag        text,
  section_tag     text check (section_tag in ('floor','section_100','section_200','upper','stage_left','stage_right')),
  caption         text,
  like_count      integer not null default 0,
  view_count      integer not null default 0,
  status          text not null default 'uploading' check (status in ('uploading','active','pending_review','removed')),
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- likes: one row per like; uniqueness enforced separately for auth vs anon
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.likes (
  id              uuid primary key default gen_random_uuid(),
  media_id        uuid not null references public.media(id) on delete cascade,
  user_id         uuid references public.users(id) on delete cascade,
  session_token   text,
  created_at      timestamptz not null default now(),
  -- Auth users: one like per (media, user). Partial because user_id is null for anon.
  unique (media_id, user_id)
);

-- Anon users: one like per (media, session_token). Partial unique.
create unique index if not exists likes_media_session_unique
  on public.likes (media_id, session_token)
  where user_id is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- follows
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.follows (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  entity_id       uuid not null references public.entities(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (user_id, entity_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes (per spec)
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists events_entity_id_idx     on public.events (entity_id);
create index if not exists events_event_date_idx    on public.events (event_date desc);
create index if not exists media_event_id_idx       on public.media  (event_id);
create index if not exists media_entity_id_idx      on public.media  (entity_id);
create index if not exists media_status_idx         on public.media  (status);
create index if not exists media_like_count_idx     on public.media  (like_count desc);
create index if not exists media_created_at_idx     on public.media  (created_at desc);
create index if not exists media_song_tag_idx       on public.media  (song_tag);
create index if not exists media_mux_upload_id_idx  on public.media  (mux_upload_id);
create index if not exists media_mux_asset_id_idx   on public.media  (mux_asset_id);
create index if not exists media_upload_session_idx on public.media  (upload_session);
create index if not exists likes_media_id_idx       on public.likes  (media_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: create a public.users row whenever an auth.users row is inserted
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: maintain events.{upload,photo,video}_count
-- Only counts rows where status = 'active'. Status transitions are tracked.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.update_event_counts_on_media()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT' and new.status = 'active') then
    update public.events
       set upload_count = upload_count + 1,
           photo_count  = photo_count + case when new.file_type = 'photo' then 1 else 0 end,
           video_count  = video_count + case when new.file_type = 'video' then 1 else 0 end
     where id = new.event_id;
  elsif (tg_op = 'UPDATE') then
    if old.status <> 'active' and new.status = 'active' then
      update public.events
         set upload_count = upload_count + 1,
             photo_count  = photo_count + case when new.file_type = 'photo' then 1 else 0 end,
             video_count  = video_count + case when new.file_type = 'video' then 1 else 0 end
       where id = new.event_id;
    elsif old.status = 'active' and new.status <> 'active' then
      update public.events
         set upload_count = greatest(upload_count - 1, 0),
             photo_count  = greatest(photo_count - case when new.file_type = 'photo' then 1 else 0 end, 0),
             video_count  = greatest(video_count - case when new.file_type = 'video' then 1 else 0 end, 0)
       where id = new.event_id;
    end if;
  elsif (tg_op = 'DELETE' and old.status = 'active') then
    update public.events
       set upload_count = greatest(upload_count - 1, 0),
           photo_count  = greatest(photo_count - case when old.file_type = 'photo' then 1 else 0 end, 0),
           video_count  = greatest(video_count - case when old.file_type = 'video' then 1 else 0 end, 0)
     where id = old.event_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists media_counts_trigger on public.media;
create trigger media_counts_trigger
  after insert or update or delete on public.media
  for each row execute function public.update_event_counts_on_media();

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: maintain media.like_count
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.update_media_like_count()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    update public.media set like_count = like_count + 1 where id = new.media_id;
  elsif (tg_op = 'DELETE') then
    update public.media set like_count = greatest(like_count - 1, 0) where id = old.media_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists likes_count_trigger on public.likes;
create trigger likes_count_trigger
  after insert or delete on public.likes
  for each row execute function public.update_media_like_count();

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: maintain entities.follower_count
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.update_entity_follower_count()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    update public.entities set follower_count = follower_count + 1 where id = new.entity_id;
  elsif (tg_op = 'DELETE') then
    update public.entities set follower_count = greatest(follower_count - 1, 0) where id = old.entity_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists follows_count_trigger on public.follows;
create trigger follows_count_trigger
  after insert or delete on public.follows
  for each row execute function public.update_entity_follower_count();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- All writes happen through API routes using the service-role key, which
-- bypasses RLS. These policies define what anon/authenticated clients can
-- *read* directly (e.g. via the supabase-js library in a Server Component).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.entities enable row level security;
alter table public.events   enable row level security;
alter table public.media    enable row level security;
alter table public.users    enable row level security;
alter table public.likes    enable row level security;
alter table public.follows  enable row level security;

-- entities & events: fully public for read
drop policy if exists entities_public_read on public.entities;
create policy entities_public_read on public.entities for select using (true);

drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events for select using (true);

-- media: only show active items publicly
drop policy if exists media_public_read on public.media;
create policy media_public_read on public.media for select using (status = 'active');

-- users: public profile data is fine to read (sensitive info lives on auth.users)
drop policy if exists users_public_read on public.users;
create policy users_public_read on public.users for select using (true);

drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- likes: count read is public; authed users may insert/delete their own.
-- Anonymous likes go through the API (service role).
drop policy if exists likes_public_read on public.likes;
create policy likes_public_read on public.likes for select using (true);

drop policy if exists likes_auth_insert on public.likes;
create policy likes_auth_insert on public.likes for insert
  with check (auth.uid() is not null and user_id = auth.uid());

drop policy if exists likes_auth_delete on public.likes;
create policy likes_auth_delete on public.likes for delete
  using (auth.uid() is not null and user_id = auth.uid());

-- follows: count read is public; only authed users follow.
drop policy if exists follows_public_read on public.follows;
create policy follows_public_read on public.follows for select using (true);

drop policy if exists follows_self_insert on public.follows;
create policy follows_self_insert on public.follows for insert
  with check (auth.uid() = user_id);

drop policy if exists follows_self_delete on public.follows;
create policy follows_self_delete on public.follows for delete
  using (auth.uid() = user_id);
