// /sports — Browse page pre-filtered to sports teams only.

import Image from 'next/image';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { formatCount } from '@/components/format';
import { loadBrowseDataset } from '@/lib/browse-data';
import { BrowseClient } from '@/app/browse/browse-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sports · c·roll',
  description: 'Every sports team on c·roll — filter and sort.',
};

export default async function SportsPage() {
  const { entities, events, isAuthed, followingSlugs } = await loadBrowseDataset();

  const teamEntities = entities.filter((e) => e.type === 'team');
  const teamSlugs = new Set(teamEntities.map((e) => e.slug));
  const teamEvents = events.filter((ev) => ev.entity && teamSlugs.has(ev.entity.slug));
  const teamClips = teamEntities.reduce((sum, e) => sum + e.upload_count, 0);

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
            // C·ROLL · SPORTS
          </p>
          <h1 className="mt-3 font-display text-[clamp(2.25rem,5vw,4rem)] font-black leading-[0.95] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.7)]">
            Sports.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-gray-400">
            <span className="text-white">{formatCount(teamEntities.length)}</span> teams.{' '}
            <span className="text-white">{formatCount(teamEvents.length)}</span> games archived.{' '}
            <span className="text-white">{formatCount(teamClips)}</span> clips.
          </p>
        </div>
      </section>

      <BrowseClient
        entities={teamEntities}
        events={teamEvents}
        isAuthed={isAuthed}
        followingSlugs={followingSlugs}
        lockedType="team"
      />

      <Footer />
    </div>
  );
}
