// GET /api/events/[slug]/qr
//
// Returns a PNG QR code that encodes the public upload URL for this event:
//   ${NEXT_PUBLIC_APP_URL}/upload/${slug}
//
// Used by admins to print QR codes for venue flyers — scan to land directly
// on the upload flow for that show.
//
// Query params:
//   ?size=<int>  optional, 128–1024, default 512.

import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createAdminClient } from '@/lib/supabase/admin';

const DEFAULT_SIZE = 512;
const MIN_SIZE = 128;
const MAX_SIZE = 1024;

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: 'slug required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: event, error } = await supabase
    .from('events')
    .select('id, slug')
    .eq('slug', slug)
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ error: 'event not found' }, { status: 404 });
  }

  const sizeParam = Number(req.nextUrl.searchParams.get('size') ?? DEFAULT_SIZE);
  const size = Number.isFinite(sizeParam)
    ? Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(sizeParam)))
    : DEFAULT_SIZE;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const url = `${appUrl}/upload/${event.slug}`;

  let png: Buffer;
  try {
    png = await QRCode.toBuffer(url, {
      type: 'png',
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#FFFFFF' },
    });
  } catch {
    return NextResponse.json({ error: 'qr generation failed' }, { status: 500 });
  }

  // Wrap as Uint8Array — Buffer isn't a `BodyInit` under newer @types/node.
  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(png.byteLength),
      // Caches are fine for 1 day — the QR target URL never changes per slug.
      'Cache-Control': 'public, max-age=86400, immutable',
      'Content-Disposition': `inline; filename="c-roll-${event.slug}.png"`,
    },
  });
}
