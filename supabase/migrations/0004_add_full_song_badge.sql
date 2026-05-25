-- Add the `is_full_song` flag to media. Set to true by the Mux webhook when
-- the video's reported duration is >= 150 seconds — our heuristic for "this
-- clip captures a complete song". Photos always remain false (videos only).

alter table public.media
  add column if not exists is_full_song boolean not null default false;

-- Partial index — most rows are false, so this stays tiny and only helps the
-- queries that actually look up full-song clips.
create index if not exists media_is_full_song_idx
  on public.media (is_full_song)
  where is_full_song = true;
