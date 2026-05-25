// POST /api/attendance/toggle
//
// Toggle the current user's attendance for an event. Mirrors the like-toggle
// pattern: look up → delete if exists, insert if not. Auth required —
// unauthenticated callers get 401 so the UI can prompt sign-up.
//
// Request:  { eventId: string }
// Response: { attending: boolean, count: number }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  let body: { eventId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const eventId = body.eventId;
  if (typeof eventId !== 'string' || !eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 });
  }

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Check existing attendance (RLS allows self-read).
  const { data: existing, error: lookupErr } = await supabase
    .from('attended_events')
    .select('id')
    .eq('user_id', user.id)
    .eq('event_id', eventId)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 });
  }

  let attending: boolean;
  if (existing) {
    const { error } = await supabase
      .from('attended_events')
      .delete()
      .eq('id', existing.id);
    if (error) return NextResponse.json({ error: 'unattend failed' }, { status: 500 });
    attending = false;
  } else {
    const { error } = await supabase
      .from('attended_events')
      .insert({ user_id: user.id, event_id: eventId });
    if (error) return NextResponse.json({ error: 'attend failed' }, { status: 500 });
    attending = true;
  }

  // Fresh attendee count — use admin client to bypass any RLS edge cases on count(*).
  const admin = createAdminClient();
  const { count } = await admin
    .from('attended_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId);

  return NextResponse.json({ attending, count: count ?? 0 });
}
