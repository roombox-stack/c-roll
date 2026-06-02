# C-Roll — Claude Code project instructions

Standing rules for Claude Code when working in this repo.

## Stack
- Node 20, TypeScript strict
- Database: Supabase client directly — no Prisma
- Tests: Vitest only. Never Jest.
- Styling: Tailwind CSS only.

## Architecture
- Controllers call services. Services call DB. Never bypass this chain.
- DB counters (likes, views, uploads) are maintained by Postgres triggers — never update in application code.
- Anonymous users: session token in localStorage. Attach uploads/likes to session_token until account creation.
- Media status: uploading (on presign) → active (photos: /upload/complete; videos: Mux webhook).

## TypeScript
- Never use any. Use unknown + type guards.
- All API route handlers must have typed request/response shapes.
- Supabase query results must be narrowed before use.

## Naming
- Files: kebab-case (upload-flow.tsx)
- Classes/Components: PascalCase (UploadFlow)
- Hooks: use* prefix (useSessionToken)
- API routes: /api/[resource]/[action]

## Constraints
- No forced account creation before uploading — ever. Account prompt only on upload success screen.
- SSR required on all public pages. Admin routes can be client-only.
- Never expose Supabase service role key to the client.

## Database migrations
Every new migration that creates a table MUST include an explicit GRANT block inline in the same file. Do not rely on alter default privileges.

Example: grant select, insert, update, delete on table public.<table_name> to anon, authenticated;

Background: migrations 0002_grants.sql and 0009_explicit_table_grants.sql covered existing tables — new ones do not get those automatically.

## Current phase
Phase 5: Upload flow UI (file picker → optional tagging → direct upload to Mux/R2 → success screen). Phase 6 next: SEO polish, view dedup, infinite scroll.