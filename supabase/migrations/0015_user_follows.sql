-- User-to-user follows.
-- The existing `follows` table is user→entity only.
-- This table lets users follow each other.

create table if not exists public.user_follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid not null references public.users(id) on delete cascade,
  following_id uuid not null references public.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id != following_id)
);

grant select, insert, delete on table public.user_follows to anon, authenticated;

-- Maintain counts on users table.
alter table public.users
  add column if not exists follower_count  integer not null default 0,
  add column if not exists following_count integer not null default 0;

create or replace function update_user_follow_counts()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update public.users set follower_count  = follower_count  + 1 where id = NEW.following_id;
    update public.users set following_count = following_count + 1 where id = NEW.follower_id;
  elsif TG_OP = 'DELETE' then
    update public.users set follower_count  = greatest(0, follower_count  - 1) where id = OLD.following_id;
    update public.users set following_count = greatest(0, following_count - 1) where id = OLD.follower_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_user_follow_counts on public.user_follows;
create trigger trg_user_follow_counts
  after insert or delete on public.user_follows
  for each row execute function update_user_follow_counts();

-- Enable RLS.
alter table public.user_follows enable row level security;

create policy "Anyone can read user_follows"
  on public.user_follows for select using (true);

create policy "Authenticated users can follow"
  on public.user_follows for insert
  with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on public.user_follows for delete
  using (auth.uid() = follower_id);
