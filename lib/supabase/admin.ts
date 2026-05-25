// Service-role Supabase client. SERVER-ONLY. Bypasses RLS — handle with care.
// Use exclusively inside API route handlers and server-side helpers that have
// already validated the caller (e.g. admin middleware, upload flow checks).

import 'server-only';
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;
  cached = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      // Next.js wraps global fetch with a per-request cache. Supabase-js uses
      // that wrapped fetch, so without an opt-out our queries can serve stale
      // rows across renders even with `dynamic = 'force-dynamic'`. Disable.
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, cache: 'no-store' as RequestCache }),
      },
    },
  );
  return cached;
}
