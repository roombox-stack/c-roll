// /search — search results page. The interactive piece is a client component
// (debounced fetch) so we can update results as the user types without a
// round-trip per keystroke. Initial render reads ?q= for SEO + shareable URLs.

import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { SearchView } from './search-view';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search artists, teams, and shows on c-roll.',
};

export default function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="sr-only">Search</h1>
        <SearchView initialQuery={searchParams.q ?? ''} />
      </main>
      <Footer />
    </div>
  );
}
