// POST /api/claim-request
// Public, no auth. Submits a page claim request into page_claims.
// Rate-limited: one submission per email per 24 hours.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const role = String(body.role ?? '').trim();
  const social_handle = String(body.social_handle ?? '').trim() || null;
  const entity_type = String(body.entity_type ?? 'music').trim();
  const message = String(body.message ?? '').trim().slice(0, 500) || null;

  // Validate required fields
  if (!name || !email || !role) {
    return NextResponse.json({ error: 'name, email, and role are required' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }
  const validRoles = ['artist', 'manager', 'label', 'publicist', 'other'];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }
  const validTypes = ['music', 'sports', 'event_brand', 'venue'];
  if (!validTypes.includes(entity_type)) {
    return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Rate limit: one submission per email per 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from('page_claims')
    .select('id')
    .eq('email', email)
    .gte('created_at', since)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "You've already submitted a request. We'll be in touch." },
      { status: 429 },
    );
  }

  const { data, error } = await supabase
    .from('page_claims')
    .insert({ name, email, role, social_handle, entity_type, message, status: 'pending' })
    .select('id')
    .single();

  if (error) {
    console.error('claim-request insert error:', error);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id });
}
