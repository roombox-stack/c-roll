// POST /api/contact
// Save a contact form submission.
// Request:  { name, email, message }
// Response: { ok: true }

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  let body: { name?: unknown; email?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const name = body.name;
  const email = body.email;
  const message = body.message;

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'valid email required' }, { status: 400 });
  }
  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'message required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('contact_submissions').insert({
    name: name.trim(),
    email: email.trim(),
    message: message.trim(),
  });

  if (error) {
    return NextResponse.json({ error: 'insert failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
