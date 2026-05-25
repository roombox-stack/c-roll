import type { Metadata } from 'next';

// Root layout for /admin/*. Intentionally minimal — the sidebar lives in the
// (shell) route group so the login page (which is in /admin but outside the
// shell) doesn't inherit it.

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
