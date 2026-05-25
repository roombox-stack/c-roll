// Admin route protection.
//
// Spec: gate /admin and /api/admin behind a shared secret. To stay usable in a
// browser without curl/header extensions, we accept either:
//   - x-admin-key header equal to ADMIN_KEY
//   - showside_admin cookie equal to ADMIN_KEY (set by /api/admin/login)
//
// The login endpoint itself is exempted so admins can authenticate from a browser.

import { NextResponse, type NextRequest } from 'next/server';

const ADMIN_COOKIE = 'showside_admin';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Open by design — login page + login API.
  if (pathname === '/api/admin/login' || pathname === '/admin/login') {
    return NextResponse.next();
  }

  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    return new NextResponse('Server misconfigured: ADMIN_KEY unset', { status: 500 });
  }

  const headerKey = req.headers.get('x-admin-key');
  const cookieKey = req.cookies.get(ADMIN_COOKIE)?.value;

  if (headerKey === expected || cookieKey === expected) {
    return NextResponse.next();
  }

  // API routes return JSON 401; admin pages redirect to the login form with a
  // `next` param so we can send the user back to what they were trying to view.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/admin/login';
  loginUrl.search = '';
  if (pathname !== '/admin') loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
