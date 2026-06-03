// PATCH /api/admin/requests/[id]
// Admin-only (middleware guards /api/admin/*).
// Body: { action: 'approve' | 'reject', admin_notes?: string }

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, admin_notes } = body as { action?: string; admin_notes?: string };
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: request, error: fetchErr } = await supabase
    .from('content_requests')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchErr || !request) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  const status = action === 'approve' ? 'approved' : 'rejected';
  const { data: updated, error: updateErr } = await supabase
    .from('content_requests')
    .update({
      status,
      admin_notes: admin_notes ?? null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'admin',
    })
    .eq('id', params.id)
    .select()
    .single();

  if (updateErr) {
    console.error('content_requests PATCH error:', updateErr);
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
  }

  // Send approval email — fire-and-forget
  if (action === 'approve') {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      const payload = request.payload as Record<string, unknown>;
      const name =
        request.type === 'entity'
          ? String(payload.name ?? '')
          : `${String(payload.entity_name ?? '')} @ ${String(payload.venue ?? '')}`;

      const bodySnippet =
        request.type === 'entity'
          ? `<p>You can search for their page on <a href="https://c-roll.app" style="color:#FFCC00">c-roll.app</a> — it'll appear on the site soon.</p>`
          : `<p>The show will appear on C-Roll soon — check back at <a href="https://c-roll.app" style="color:#FFCC00">c-roll.app</a>.</p>`;

      const emailResult = await resend.emails.send({
        from: 'c-roll <notifications@c-roll.app>',
        to: request.requester_email,
        subject: 'Your C-Roll request was approved 🎉',
        html: `
          <div style="font-family:monospace;background:#0a0a0a;color:#e5e5e5;padding:32px;max-width:560px">
            <p style="color:#FFCC00;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px">
              // C·ROLL
            </p>
            <p>Hi,</p>
            <p>Good news — your request to add <strong>${name}</strong> to C-Roll has been approved.</p>
            ${bodySnippet}
            <p>Thanks for helping build the archive.</p>
            <p style="color:#888">— The C-Roll team</p>
          </div>
        `,
      });
      if (emailResult.error) {
        console.error('approval email failed:', emailResult.error);
      }
    }
  }

  return NextResponse.json(updated);
}
