// POST /api/dmca
// Save a DMCA takedown request.
// Request:  { url, description, contactEmail }
// Response: { ok: true }

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  let body: { url?: unknown; description?: unknown; contactEmail?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const url = body.url;
  const description = body.description;
  const contactEmail = body.contactEmail;

  if (typeof url !== 'string' || !url.trim()) {
    return NextResponse.json({ error: 'url required' }, { status: 400 });
  }
  if (typeof description !== 'string' || !description.trim()) {
    return NextResponse.json({ error: 'description required' }, { status: 400 });
  }
  if (typeof contactEmail !== 'string' || !contactEmail.includes('@')) {
    return NextResponse.json({ error: 'valid contactEmail required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('dmca_requests').insert({
    url: url.trim(),
    description: description.trim(),
    contact_email: contactEmail.trim(),
  });

  if (error) {
    return NextResponse.json({ error: 'insert failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
