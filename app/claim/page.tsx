// /claim — public "Get your C-Roll page" form.
// Pre-populates name + type when arriving from an entity page's "Is this you?" link.

import type { Metadata } from 'next';
import { ClaimForm } from './claim-form';

export const metadata: Metadata = {
  title: 'Get your C-Roll page',
  description:
    'C-Roll is where fans upload and watch footage from live shows. Claim your page and tell your fans to start filming.',
};

export default function ClaimPage({
  searchParams,
}: {
  searchParams: { name?: string; type?: string };
}) {
  return (
    <div className="min-h-screen bg-ink text-white">
      <div className="mx-auto max-w-xl px-4 py-16 md:py-24">
        <p className="font-mono text-[11px] uppercase tracking-widest text-croll">
          // FOR ARTISTS
        </p>
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight tracking-tight md:text-5xl">
          Get your C·Roll page.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-gray-400">
          C·Roll is where fans upload and watch footage from live shows. If you&apos;re an artist,
          claim your page and tell your fans to start filming.
        </p>

        <div className="mt-10">
          <ClaimForm
            defaultName={searchParams.name ?? ''}
            defaultType={searchParams.type ?? 'music'}
          />
        </div>
      </div>
    </div>
  );
}
