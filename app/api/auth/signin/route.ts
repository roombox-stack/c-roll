// POST /api/auth/signin
//
// Email + password sign-in. Sets session cookies via the SSR server client.
//
// Request:  { email, password }
// Response: { ok: true, profile: { username } } or { error }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message ?? 'invalid credentials' },
      { status: 401 },
    );
  }

  const { data: profile } = await supabase
    .from('users')
    .select('username')
    .eq('id', data.user.id)
    .maybeSingle();

  return NextResponse.json({ ok: true, profile: { username: profile?.username ?? null } });
}
