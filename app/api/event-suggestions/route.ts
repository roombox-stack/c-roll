// POST /api/event-suggestions
//
// Anonymous (or authenticated) submission of a "can't find your event?"
// suggestion. Saved to public.event_suggestions for admin review later.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidSessionToken } from '@/lib/session';

const MAX_LENGTH = 500;

export async function POST(req: NextRequest) {
  let body: { text?: unknown; sessionToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return NextResponse.json({ error: 'text required' }, { status: 400 });
  }
  if (text.length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `text exceeds ${MAX_LENGTH} chars` },
      { status: 400 },
    );
  }

  const sessionToken =
    typeof body.sessionToken === 'string' && isValidSessionToken(body.sessionToken)
      ? body.sessionToken
      : null;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('event_suggestions')
    .insert({ text, session_token: sessionToken });
  if (error) {
    return NextResponse.json({ error: 'failed to save' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
