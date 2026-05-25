'use server';

// Admin login server action. Sets the `showside_admin` cookie (same one the
// middleware reads) and redirects.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE_NAME = 'showside_admin';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function loginAdmin(formData: FormData) {
  const key = String(formData.get('key') ?? '').trim();
  const next = String(formData.get('next') ?? '').trim();
  const expected = process.env.ADMIN_KEY;

  if (!expected) {
    throw new Error('server misconfigured: ADMIN_KEY unset');
  }

  if (key !== expected) {
    const params = new URLSearchParams({ error: '1' });
    if (next) params.set('next', next);
    redirect(`/admin/login?${params.toString()}`);
  }

  cookies().set(COOKIE_NAME, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: THIRTY_DAYS,
  });

  // Only allow redirecting back to /admin/* paths — never an open redirect.
  const safeNext =
    next.startsWith('/admin/') && next !== '/admin/login' ? next : '/admin';
  redirect(safeNext);
}

export async function logoutAdmin() {
  cookies().delete(COOKIE_NAME);
  redirect('/admin/login');
}
