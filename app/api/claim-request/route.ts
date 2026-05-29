// POST /api/claim-request
// Public, no auth. Submits a page claim request into page_claims.
// Rate-limited: one submission per email per 24 hours.
// Sends an admin notification email via Resend on each new submission.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';

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

  // Send admin notification email — fire-and-forget (don't fail the request if email fails)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const resend = new Resend(resendKey);
    const roleLabel: Record<string, string> = {
      artist: 'Artist', manager: 'Manager', label: 'Label', publicist: 'Publicist', other: 'Other',
    };
    const typeLabel: Record<string, string> = {
      music: 'Music', sports: 'Sports', event_brand: 'Event Brand', venue: 'Venue',
    };
    resend.emails.send({
      from: 'c-roll <notifications@c-roll.app>',
      to: 'mpocock@c-roll.app',
      subject: `New page request: ${name}`,
      html: `
        <div style="font-family:monospace;background:#0a0a0a;color:#e5e5e5;padding:32px;max-width:560px">
          <p style="color:#FFCC00;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px">
            // C·ROLL · NEW PAGE REQUEST
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="color:#888;padding:6px 0;width:120px">Name</td><td style="color:#fff">${name}</td></tr>
            <tr><td style="color:#888;padding:6px 0">Email</td><td style="color:#fff">${email}</td></tr>
            <tr><td style="color:#888;padding:6px 0">Role</td><td style="color:#fff">${roleLabel[role] ?? role}</td></tr>
            <tr><td style="color:#888;padding:6px 0">Type</td><td style="color:#fff">${typeLabel[entity_type] ?? entity_type}</td></tr>
            ${social_handle ? `<tr><td style="color:#888;padding:6px 0">Social</td><td style="color:#fff">${social_handle}</td></tr>` : ''}
            ${message ? `<tr><td style="color:#888;padding:6px 0;vertical-align:top">Message</td><td style="color:#ccc">${message}</td></tr>` : ''}
          </table>
          <div style="margin-top:24px">
            <a href="https://c-roll.app/admin/claims" style="background:#FFCC00;color:#0a0a0a;padding:10px 20px;text-decoration:none;font-weight:bold;font-size:13px;border-radius:4px">
              Review in admin →
            </a>
          </div>
        </div>
      `,
    }).catch((err: unknown) => console.error('claim notification email failed:', err));
  }

  return NextResponse.json({ success: true, id: data.id });
}
