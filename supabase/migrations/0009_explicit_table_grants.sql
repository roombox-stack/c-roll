-- Explicit per-table GRANTs for every table currently in the public schema.
--
-- Migration 0002 already grants `select, insert, update, delete on all tables
-- in schema public` and sets `alter default privileges` so future tables
-- inherit grants. This migration restates those grants explicitly per-table
-- so each one is auditable in source control and so any table that may have
-- been created outside the default-privilege scope (e.g. via the dashboard
-- under a different role) is brought in line.
--
-- GRANTs are idempotent — running this against a database that already has
-- the privileges is a no-op. RLS still gates what anon / authenticated rows
-- can actually read or write; these grants only open the table to PostgREST.

grant usage on schema public to anon, authenticated;

-- Core domain tables (created in 0001_init.sql)
grant select, insert, update, delete on table public.entities       to anon, authenticated;
grant select, insert, update, delete on table public.events         to anon, authenticated;
grant select, insert, update, delete on table public.users          to anon, authenticated;
grant select, insert, update, delete on table public.media          to anon, authenticated;
grant select, insert, update, delete on table public.likes          to anon, authenticated;
grant select, insert, update, delete on table public.follows        to anon, authenticated;

-- Attendance (0005_attendance.sql)
grant select, insert, update, delete on table public.attended_events to anon, authenticated;

-- Upload flow extras (0006_upload_extras.sql)
grant select, insert, update, delete on table public.event_suggestions to anon, authenticated;

-- View tracking (0007_media_views.sql)
grant select, insert, update, delete on table public.media_views    to anon, authenticated;

-- Footer-form tables (0008_footer_tables.sql)
grant select, insert, update, delete on table public.dmca_requests       to anon, authenticated;
grant select, insert, update, delete on table public.contact_submissions to anon, authenticated;
