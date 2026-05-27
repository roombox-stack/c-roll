import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'About c-roll',
  description: 'The show, from everyone who was there. A fan media platform for live events.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
        <h1 className="text-4xl font-bold">About c-roll</h1>
        <p className="mt-4 text-xl text-gray-400 leading-relaxed">
          The show, from everyone who was there.
        </p>

        <div className="mt-10 space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">
              What does &lsquo;c-roll&rsquo; mean?
            </h2>
            <p>The name has two layers working together.</p>
            <p className="mt-3">
              The <span className="text-white">C</span> stands for{' '}
              <span className="text-white">Crowd</span>. Not the artist, not the production,
              not the official broadcast — the crowd. The tens of thousands of people in the
              seats and on the floor, phones raised, capturing the same moment from a thousand
              different angles. That&rsquo;s the source material. That&rsquo;s what makes this
              different from everything else.
            </p>
            <p className="mt-3">
              <span className="text-white">Roll</span> is a filmmaking term. When a director
              calls &ldquo;roll,&rdquo; they&rsquo;re calling for the cameras to start. B-roll
              is the supplemental footage that gives a story texture and context — the
              cutaways, the atmosphere, the details the A-camera misses. It&rsquo;s a real
              category of film with a real name.
            </p>
            <p className="mt-3">C-roll doesn&rsquo;t exist yet. We&rsquo;re proposing it should.</p>
            <p className="mt-3">
              If <span className="text-white">A-roll</span> is the official broadcast — the
              polished, produced, licensed feed — and <span className="text-white">B-roll</span>{' '}
              is the behind-the-scenes and supplemental footage, then{' '}
              <span className="text-white">C-roll</span> is the crowd footage. The shaky,
              close, unfiltered, from inside it footage that no production crew can capture
              because they&rsquo;re not standing in the pit, not sitting in row 12, not
              pressed against the barrier when the lights drop.
            </p>
            <p className="mt-3">
              C-roll is what 60,000 people shoot simultaneously and post to their stories and
              then it disappears. It&rsquo;s the most abundant, least organized, most
              emotionally authentic category of footage in the world, and it has never had a
              name.
            </p>
            <p className="mt-3">
              We&rsquo;re giving it one. And building the place where it lives.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">What we are</h2>
            <p>
              c-roll is a fan media platform for live events. If you went to a show — a
              concert, a game, a festival — you can upload your photos and videos and add
              them to a permanent, public archive for that event.
            </p>
            <p className="mt-3">
              If you couldn't make it — wrong city, wrong price, wrong everything — you can
              browse the archive and experience the show through the eyes of everyone who
              was there. Not a highlight reel. Not a live stream. The real thing, shot from
              the floor, the pit, the seats, and everywhere in between.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">Why we built it</h2>
            <p>
              Concert ticket prices have gone up more than 50% since 2019. The average
              ticket to a top-100 tour was $136 in 2024. For a teenager in London who loves
              Morgan Wallen, that show isn't just expensive — it's inaccessible in every
              sense of the word.
            </p>
            <p className="mt-3">
              Meanwhile, fans who attend shoots thousands of clips every night. Most of it
              never gets posted anywhere — it sits in camera rolls, half-watched once and
              forgotten. c-roll gives that footage a permanent home and a purpose: letting
              the people who couldn't be there feel like they were.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">How it works</h2>
            <ul className="mt-2 list-inside list-disc space-y-2 text-gray-300">
              <li>Find the show you attended from an artist or team's page.</li>
              <li>Upload your photos and videos — no account needed.</li>
              <li>Tag the song or moment, and where you were in the venue.</li>
              <li>
                Your upload joins the show's archive, searchable by song, section, and date.
              </li>
            </ul>
            <p className="mt-4">
              Anonymous uploads are welcome. Create an account only if you want to track
              your show history and build your contributor profile.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">Content ownership</h2>
            <p>
              Fan-uploaded content is owned by the person who shot it. c-roll does not
              claim ownership of uploaded media. By uploading, you grant c-roll a
              non-exclusive license to display your content on the platform. You can request
              removal at any time via our{' '}
              <a href="/contact" className="text-white underline hover:no-underline">
                contact form
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
