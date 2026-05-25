// /search — search results page. The interactive piece is a client component
// (debounced fetch) so we can update results as the user types without a
// round-trip per keystroke. Initial render reads ?q= for SEO + shareable URLs.

import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { SearchView } from './search-view';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search artists, teams, and shows on Showside.',
};

export default function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  return (
    <div className="min-h-screen bg-ink text-white">
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="sr-only">Search</h1>
        <SearchView initialQuery={searchParams.q ?? ''} />
      </main>
    </div>
  );
}
