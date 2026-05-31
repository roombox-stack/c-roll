-- Add role column to users table.
alter table public.users
  add column if not exists role text not null default 'user'
  check (role in ('user', 'artist', 'admin'));
