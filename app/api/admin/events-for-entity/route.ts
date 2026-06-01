import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';

// Quick admin-only guard — same pattern as the admin login.
function isAdminAuthed(): boolean {
  const jar = cookies();
  return jar.get('admin_authed')?.value === 'true';
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const entityId = req.nextUrl.searchParams.get('entityId');
  if (!entityId) return NextResponse.json([], { status: 200 });

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('events')
    .select('id, name, event_date, city')
    .eq('entity_id', entityId)
    .order('event_date', { ascending: false })
    .limit(200);

  return NextResponse.json(data ?? []);
}
