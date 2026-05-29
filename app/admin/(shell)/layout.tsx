// Layout for authenticated admin pages. Route group `(shell)` keeps the
// sidebar out of /admin/login while still letting the URLs stay flat —
// /admin/(shell)/entities → /admin/entities.

import Link from 'next/link';
import { logoutAdmin } from '../login/actions';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/entities', label: 'Entities' },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/media', label: 'Media uploads' },
  { href: '/admin/moderation', label: 'Moderation' },
  { href: '/admin/claims', label: 'Page requests' },
];

export default function AdminShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-ink text-white">
      <aside className="flex w-56 shrink-0 flex-col border-r border-ash bg-smoke p-4">
        <Link href="/admin" className="mb-6 block text-lg font-semibold">
          c-roll admin
        </Link>
        <nav className="flex-1 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded px-3 py-2 text-sm text-gray-300 hover:bg-ash hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={logoutAdmin}>
          <button
            type="submit"
            className="w-full rounded px-3 py-2 text-left text-sm text-gray-400 hover:bg-ash hover:text-white"
          >
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 overflow-x-auto p-8">{children}</main>
    </div>
  );
}
