-- Add song_tag_source to track how a tag was applied
alter table public.media
  add column if not exists song_tag_source text default 'manual'
    check (song_tag_source in ('manual', 'auto', 'community'));

-- Community tags: one session can tag a given clip once (for abuse prevention)
create table if not exists public.community_tags (
  id           uuid primary key default gen_random_uuid(),
  media_id     uuid not null references public.media(id) on delete cascade,
  session_token text not null,
  song_tag     text not null,
  created_at   timestamptz not null default now(),
  constraint community_tags_media_session_uniq unique (media_id, session_token)
);

create index if not exists community_tags_media_id_idx on public.community_tags(media_id);

grant select, insert on table public.community_tags to anon, authenticated;
grant select, update (song_tag, song_tag_source) on table public.media to anon, authenticated;
