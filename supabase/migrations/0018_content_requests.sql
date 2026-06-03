create table content_requests (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('entity', 'event')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requester_email text not null,
  session_token text,
  payload jsonb not null,
  admin_notes text,
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by text
);

create index on content_requests (status, created_at desc);

grant select, insert, update, delete on table public.content_requests to anon, authenticated;
