// POST /api/auth/signup
//
// Email + password signup. We use the admin API with email_confirm=true so
// new users land authenticated immediately (no email round-trip for V1);
// switch to standard supabase.auth.signUp + an emailed confirmation link in
// prod when transactional email is wired up.
//
// Flow:
//   1. Validate inputs (username uniqueness, password length).
//   2. admin.createUser → creates auth.users row → trigger creates public.users.
//   3. Patch the public.users row with username + display_name.
//   4. supabase.auth.signInWithPassword on the server client → sets session cookies.
//
// Request:  { email, password, username, display_name? }
// Response: { ok: true, profile: { id, username, display_name } } or { error }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

export async function POST(req: NextRequest) {
  let body: {
    email?: unknown;
    password?: unknown;
    username?: unknown;
    display_name?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const username =
    typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const display_name =
    typeof body.display_name === 'string' && body.display_name.trim()
      ? body.display_name.trim()
      : username;

  if (!email.includes('@')) {
    return NextResponse.json({ error: 'valid email required' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: 'password must be at least 8 characters' },
      { status: 400 },
    );
  }
  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: 'username must be 3–30 chars, a–z 0–9 or underscore' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Username uniqueness check (RLS public read).
  const { data: existingUsername } = await admin
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (existingUsername) {
    return NextResponse.json({ error: 'username already taken' }, { status: 409 });
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, display_name },
  });
  if (createErr || !created.user) {
    const msg = createErr?.message ?? 'signup failed';
    const status = msg.toLowerCase().includes('registered') ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  // Set username/display_name on the public.users row created by the trigger.
  const { error: updateErr } = await admin
    .from('users')
    .update({ username, display_name })
    .eq('id', created.user.id);
  if (updateErr) {
    return NextResponse.json({ error: 'profile setup failed' }, { status: 500 });
  }

  // Sign the user in via the server client so cookies land on the response.
  const supabase = createClient();
  const { error: signinErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signinErr) {
    return NextResponse.json(
      { error: `signed up but sign-in failed: ${signinErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    profile: { id: created.user.id, username, display_name },
  });
}
