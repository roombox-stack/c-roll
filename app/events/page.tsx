// /events — Browse page pre-filtered to event brands only.

import Image from 'next/image';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { formatCount } from '@/components/format';
import { loadBrowseDataset } from '@/lib/browse-data';
import { BrowseClient } from '@/app/browse/browse-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Events · c·roll',
  description: 'Every event brand on c·roll — filter and sort.',
};

export default async function EventsPage() {
  const { entities, events, isAuthed, followingSlugs } = await loadBrowseDataset();

  const brandEntities = entities.filter((e) => e.type === 'event_brand');
  const brandSlugs = new Set(brandEntities.map((e) => e.slug));
  const brandEvents = events.filter((ev) => ev.entity && brandSlugs.has(ev.entity.slug));
  const brandClips = brandEntities.reduce((sum, e) => sum + e.upload_count, 0);

  return (
    <div className="min-h-screen bg-ink text-white">
      <Nav />

      <section className="relative overflow-hidden border-b border-white/5 bg-ink">
        <Image
          src="/hero-browse.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-right opacity-100"
          unoptimized
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 via-30% to-transparent to-50%" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-14 lg:pb-12 lg:pt-16">
          <p className="font-mono text-[10px] uppercase tracking-widest text-croll">
            // C·ROLL · EVENTS
          </p>
          <h1 className="mt-3 font-display text-[clamp(2.25rem,5vw,4rem)] font-black leading-[0.95] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.7)]">
            Events.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-gray-400">
            <span className="text-white">{formatCount(brandEntities.length)}</span> events.{' '}
            <span className="text-white">{formatCount(brandEvents.length)}</span> dates archived.{' '}
            <span className="text-white">{formatCount(brandClips)}</span> clips.
          </p>
        </div>
      </section>

      <BrowseClient
        entities={brandEntities}
        events={brandEvents}
        isAuthed={isAuthed}
        followingSlugs={followingSlugs}
        lockedType="event_brand"
      />

      <Footer />
    </div>
  );
}
