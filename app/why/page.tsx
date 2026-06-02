import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Why upload — c-roll',
  description: 'Every night, tens of thousands of fans film concerts, games, and live events. Most of that footage disappears. c-roll is where it lives instead.',
  alternates: { canonical: '/why' },
};

export default function WhyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">

        {/* Hero */}
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          For uploaders
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight">
          You were there. Now everyone else can be.
        </h1>
        <p className="mt-4 text-xl text-gray-400 leading-relaxed">
          Every night, tens of thousands of fans film concerts, games, and live events. Most of
          that footage disappears — buried in camera rolls, forgotten in Stories, lost in an
          algorithm. c-roll is where it lives instead.
        </p>
        <Link
          href="/upload"
          className="mt-6 inline-flex items-center rounded-full bg-white px-6 py-3 text-base font-semibold text-ink hover:bg-gray-200"
        >
          Upload your footage →
        </Link>

        {/* Stat strip */}
        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-ash bg-smoke/40 px-6 py-7">
            <p className="text-3xl font-bold text-white">151M</p>
            <p className="mt-1 text-sm text-gray-400">
              people attended Live Nation events in 2024
            </p>
          </div>
          <div className="rounded-xl border border-ash bg-smoke/40 px-6 py-7">
            <p className="text-3xl font-bold text-white">56%</p>
            <p className="mt-1 text-sm text-gray-400">
              of concert-goers film or share media during shows
            </p>
          </div>
          <div className="rounded-xl border border-ash bg-smoke/40 px-6 py-7">
            <p className="text-3xl font-bold text-white">50%</p>
            <p className="mt-1 text-sm text-gray-400">
              rise in average ticket prices since 2019
            </p>
          </div>
        </div>
        <p className="mt-6 text-gray-300 leading-relaxed">
          For every person inside a venue, many more wanted to be there and couldn&rsquo;t. Your
          footage isn&rsquo;t just a memory — it&rsquo;s someone else&rsquo;s window into a show
          they&rsquo;ll never afford, never reach, or never stop thinking about.
        </p>

        {/* Six reasons */}
        <div className="mt-16">
          <h2 className="text-xl font-semibold text-white">
            Six reasons to upload here instead
          </h2>
          <div className="mt-6 space-y-8 text-gray-300 leading-relaxed">
            <div className="flex gap-4">
              <span className="mt-0.5 text-xl">📌</span>
              <div>
                <h3 className="font-semibold text-white">It&rsquo;s permanent</h3>
                <p className="mt-1">
                  Instagram Stories vanish in 24 hours. TikToks get buried. a c-roll upload
                  lives at a permanent URL — searchable, shareable, and findable years from
                  now. The show happened. The record should too.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="mt-0.5 text-xl">🔍</span>
              <div>
                <h3 className="font-semibold text-white">People can actually find your clip</h3>
                <p className="mt-1">
                  On YouTube, your clip competes against every other upload ever. on c-roll,
                  it&rsquo;s organized by artist, event, date, and section. Someone searching
                  for &ldquo;Morgan Wallen Boston May 2026&rdquo; finds your clip directly —
                  not 400 others.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="mt-0.5 text-xl">👤</span>
              <div>
                <h3 className="font-semibold text-white">You get credit, forever</h3>
                <p className="mt-1">
                  Every upload carries your name (or handle). Contribute to enough shows and
                  you build a public contributor profile — a record of every show you shot,
                  every venue you were in, every moment you captured. No other platform does
                  this.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="mt-0.5 text-xl">❤️</span>
              <div>
                <h3 className="font-semibold text-white">Your clip is someone else&rsquo;s whole night</h3>
                <p className="mt-1">
                  The 16-year-old in London who loves Sabrina Carpenter and will never afford a
                  stadium ticket — she&rsquo;s going to watch your clip. She&rsquo;s going to
                  watch it twice. Your shaky, front-row, unfiltered footage is more valuable to
                  her than any official broadcast ever could be.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="mt-0.5 text-xl">📡</span>
              <div>
                <h3 className="font-semibold text-white">No algorithm to fight</h3>
                <p className="mt-1">
                  On TikTok and YouTube, your clip succeeds or fails based on watch time,
                  posting time, trending sounds, and a hundred things you don&rsquo;t control.
                  on c-roll, your clip is surfaced to everyone looking at that event —
                  automatically, forever, regardless of when you uploaded it.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="mt-0.5 text-xl">⚡</span>
              <div>
                <h3 className="font-semibold text-white">Upload in under 60 seconds</h3>
                <p className="mt-1">
                  No account required. No app to download. Open the event page on your phone,
                  tap Upload, pick your files, and you&rsquo;re done — the upload runs in the
                  background while you live your life. Tag the song and your section if you
                  want, or skip it entirely. Either way, it goes up.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Comparison table */}
        <div className="mt-16">
          <h2 className="text-xl font-semibold text-white">How we compare</h2>
          <div className="mt-6 overflow-x-auto rounded-xl border border-ash">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ash bg-smoke/60">
                  <th className="px-4 py-3 text-left font-semibold text-white">Feature</th>
                  <th className="px-4 py-3 text-left font-semibold text-croll">c-roll</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-300">Instagram &amp; TikTok</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-300">YouTube</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-b border-ash">
                  <td className="px-4 py-3">Permanent archive</td>
                  <td className="px-4 py-3 text-emerald-400">✓</td>
                  <td className="px-4 py-3 text-red-400">✗</td>
                  <td className="px-4 py-3 text-emerald-400">✓</td>
                </tr>
                <tr className="border-b border-ash bg-smoke/30">
                  <td className="px-4 py-3">Organized by event (Artist → show → song → section)</td>
                  <td className="px-4 py-3 text-emerald-400">✓</td>
                  <td className="px-4 py-3 text-red-400">✗</td>
                  <td className="px-4 py-3 text-red-400">✗</td>
                </tr>
                <tr className="border-b border-ash">
                  <td className="px-4 py-3">Searchable by song</td>
                  <td className="px-4 py-3 text-emerald-400">✓</td>
                  <td className="px-4 py-3 text-red-400">✗</td>
                  <td className="px-4 py-3 text-red-400">✗</td>
                </tr>
                <tr className="border-b border-ash bg-smoke/30">
                  <td className="px-4 py-3">Algorithm-free discovery</td>
                  <td className="px-4 py-3 text-emerald-400">✓</td>
                  <td className="px-4 py-3 text-red-400">✗</td>
                  <td className="px-4 py-3 text-red-400">✗</td>
                </tr>
                <tr className="border-b border-ash">
                  <td className="px-4 py-3">Uploader credit</td>
                  <td className="px-4 py-3 text-emerald-400">✓</td>
                  <td className="px-4 py-3 text-emerald-400">✓</td>
                  <td className="px-4 py-3 text-emerald-400">✓</td>
                </tr>
                <tr className="border-b border-ash bg-smoke/30">
                  <td className="px-4 py-3">Account required to upload</td>
                  <td className="px-4 py-3 text-emerald-400">No</td>
                  <td className="px-4 py-3 text-red-400">Yes</td>
                  <td className="px-4 py-3 text-red-400">Yes</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">You own the content</td>
                  <td className="px-4 py-3 text-emerald-400">✓</td>
                  <td className="px-4 py-3 text-red-400">✗</td>
                  <td className="px-4 py-3 text-red-400">✗</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Pull quote */}
        <blockquote className="mt-16 border-l-4 border-croll pl-6 text-gray-300 leading-relaxed">
          <p className="text-lg">
            &ldquo;In filmmaking, c-roll is the third camera — the one capturing unexpected
            details no one else thought to cover. To us, the C also stands for crowd. Sixty
            thousand people, each running their own camera, from angles no production crew could
            ever reach.&rdquo;
          </p>
          <footer className="mt-3 text-sm text-gray-500">— c-roll, on the name</footer>
        </blockquote>

        {/* Bottom CTA */}
        <div className="mt-16 rounded-xl border border-ash bg-smoke/40 px-6 py-10 text-center">
          <h2 className="text-2xl font-bold text-white">
            You were in the room. Leave a record of it.
          </h2>
          <p className="mt-3 text-gray-400 leading-relaxed">
            Find the show you attended and upload your footage in under 60 seconds. No account.
            No app. Just the show.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center rounded-full bg-white px-6 py-3 text-base font-semibold text-ink hover:bg-gray-200"
          >
            Find your show →
          </Link>
        </div>

      </main>
      <Footer />
    </div>
  );
}
