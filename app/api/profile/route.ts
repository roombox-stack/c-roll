// PATCH /api/profile
//
// Update the current user's display_name and bio.
// Auth required — 401 for unauthenticated callers.
//
// Request:  { displayName?: string, bio?: string }
// Response: { ok: true }
//
// Validation:
//   displayName — optional, max 80 chars after trim
//   bio         — optional, max 160 chars after trim; empty string clears it

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAX_DISPLAY_NAME = 80;
const MAX_BIO = 160;

export async function PATCH(req: NextRequest) {
  let body: { displayName?: unknown; bio?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const updates: Record<string, string | null> = {};

  if ('displayName' in body) {
    if (typeof body.displayName !== 'string') {
      return NextResponse.json({ error: 'displayName must be a string' }, { status: 400 });
    }
    const trimmed = body.displayName.trim();
    if (trimmed.length > MAX_DISPLAY_NAME) {
      return NextResponse.json(
        { error: `displayName max ${MAX_DISPLAY_NAME} chars` },
        { status: 400 },
      );
    }
    updates.display_name = trimmed || null;
  }

  if ('bio' in body) {
    if (typeof body.bio !== 'string') {
      return NextResponse.json({ error: 'bio must be a string' }, { status: 400 });
    }
    const trimmed = body.bio.trim();
    if (trimmed.length > MAX_BIO) {
      return NextResponse.json({ error: `bio max ${MAX_BIO} chars` }, { status: 400 });
    }
    updates.bio = trimmed || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
