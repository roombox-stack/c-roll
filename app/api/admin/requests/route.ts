// GET /api/admin/requests
// Admin-only (middleware guards /api/admin/*).
// Query params: status (default 'pending'), type (optional).

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status') ?? 'pending';
  const type = searchParams.get('type');

  const supabase = createAdminClient();
  let query = supabase
    .from('content_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }
  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) {
    console.error('content_requests GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
