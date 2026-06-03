// POST /api/requests
// Public, no auth. Submits a content request (entity or event) into content_requests.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ENTITY_TYPES = ['musician', 'sports_team', 'recurring_event'] as const;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const type = String(body.type ?? '').trim();
  if (type !== 'entity' && type !== 'event') {
    return NextResponse.json({ error: 'type must be "entity" or "event"' }, { status: 400 });
  }

  const requester_email = String(body.requester_email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(requester_email)) {
    return NextResponse.json({ error: 'Invalid requester_email' }, { status: 400 });
  }

  const rawPayload = body.payload as Record<string, unknown> | undefined;
  if (!rawPayload || typeof rawPayload !== 'object') {
    return NextResponse.json({ error: 'payload is required' }, { status: 400 });
  }

  // Validate payload fields based on type
  if (type === 'entity') {
    const name = String(rawPayload.name ?? '').trim();
    const entity_type = String(rawPayload.entity_type ?? '').trim();
    if (!name) return NextResponse.json({ error: 'payload.name is required' }, { status: 400 });
    if (!VALID_ENTITY_TYPES.includes(entity_type as (typeof VALID_ENTITY_TYPES)[number])) {
      return NextResponse.json(
        { error: 'payload.entity_type must be one of: musician, sports_team, recurring_event' },
        { status: 400 },
      );
    }
  } else {
    const entity_name = String(rawPayload.entity_name ?? '').trim();
    const venue = String(rawPayload.venue ?? '').trim();
    const city = String(rawPayload.city ?? '').trim();
    const date = String(rawPayload.date ?? '').trim();
    if (!entity_name) return NextResponse.json({ error: 'payload.entity_name is required' }, { status: 400 });
    if (!venue) return NextResponse.json({ error: 'payload.venue is required' }, { status: 400 });
    if (!city) return NextResponse.json({ error: 'payload.city is required' }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'payload.date must be YYYY-MM-DD' }, { status: 400 });
    }
  }

  // Read session token from cookie (nice-to-have)
  const session_token = req.cookies.get('croll_session')?.value ?? null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('content_requests')
    .insert({ type, status: 'pending', requester_email, session_token, payload: rawPayload })
    .select('id')
    .single();

  if (error) {
    console.error('content_requests insert error:', error);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id }, { status: 201 });
}
