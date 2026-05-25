-- Grant Supabase's standard roles access to the public schema.
--
-- When tables are created via the dashboard's table editor, Supabase auto-grants
-- privileges to anon / authenticated / service_role. When tables are created via
-- raw SQL (as we did in 0001_init.sql), those grants are NOT applied — leaving
-- PostgREST returning 403 "permission denied" even for the service role.
--
-- RLS still gates what anon and authenticated rows can actually read/write;
-- service_role bypasses RLS (it's BYPASSRLS) so the grants below give it the
-- full access we expect from the API routes.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

grant execute on all functions in schema public
  to anon, authenticated, service_role;

-- Make future tables (created later) inherit these grants by default.
alter default privileges in schema public
  grant select, insert, update, delete on tables
  to anon, authenticated, service_role;

alter default privileges in schema public
  grant usage, select on sequences
  to anon, authenticated, service_role;

alter default privileges in schema public
  grant execute on functions
  to anon, authenticated, service_role;
