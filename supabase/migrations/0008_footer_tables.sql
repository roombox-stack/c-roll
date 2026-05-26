-- Phase 6.3 footer pages.
-- Stores DMCA takedown requests and general contact submissions.

-- ── dmca_requests ─────────────────────────────────────────────────────────────
create table if not exists public.dmca_requests (
  id             uuid primary key default gen_random_uuid(),
  url            text not null,
  description    text not null,
  contact_email  text not null,
  created_at     timestamptz not null default now()
);

alter table public.dmca_requests enable row level security;

drop policy if exists dmca_requests_insert on public.dmca_requests;
create policy dmca_requests_insert on public.dmca_requests
  for insert with check (true);

grant select, insert on public.dmca_requests to anon, authenticated, service_role;

-- ── contact_submissions ───────────────────────────────────────────────────────
create table if not exists public.contact_submissions (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  email    text not null,
  message  text not null,
  created_at timestamptz not null default now()
);

alter table public.contact_submissions enable row level security;

drop policy if exists contact_submissions_insert on public.contact_submissions;
create policy contact_submissions_insert on public.contact_submissions
  for insert with check (true);

grant select, insert on public.contact_submissions to anon, authenticated, service_role;
