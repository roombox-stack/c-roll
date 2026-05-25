// POST /api/admin/login
//
// Validates an `ADMIN_KEY` body and sets the `showside_admin` cookie, which the
// admin middleware accepts (alongside the `x-admin-key` header) for browser use.
//
// Body: { key: string } as JSON.
// 200 + Set-Cookie on success. 401 otherwise.
// This route is exempted from the admin middleware (see middleware.ts).

import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'showside_admin';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function POST(req: NextRequest) {
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    return NextResponse.json({ error: 'server misconfigured' }, { status: 500 });
  }

  let key: unknown;
  try {
    const body = await req.json();
    key = body?.key;
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 });
  }

  if (typeof key !== 'string' || key !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: THIRTY_DAYS,
  });
  return res;
}

// Convenience for logging out — clears the cookie.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
