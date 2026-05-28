# C-Roll — Claude Code project instructions

Standing rules for Claude Code when working in this repo. Keep this short and
load-bearing — only things Claude needs to remember across sessions.

## Database migrations

**Every new migration that creates a table MUST include an explicit `GRANT`
block for that table inline in the same file.** Do not rely on
`alter default privileges` to catch new tables automatically — that's a
defense-in-depth, not the primary mechanism.

Template:

```sql
create table if not exists public.<table_name> (
  -- columns
);

-- Grants — required for PostgREST (anon / authenticated) to see the table.
grant select, insert, update, delete on table public.<table_name>
  to anon, authenticated;
```

Apply to every future table including V2 work (audio fingerprinting,
notifications, anything else). Grants for sequences and functions follow the
same rule — if a migration creates them, grant them in the same file.

Background: migrations `0002_grants.sql` and `0009_explicit_table_grants.sql`
set up blanket + per-table grants for everything that existed up to that
point. New migrations don't get those grants for free, even with default
privileges in place, so make them explicit.
