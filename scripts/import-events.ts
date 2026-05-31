// scripts/import-events.ts
//
// Seeds entities and imports upcoming Ticketmaster events for each one
// into the `events` table, covering the next 60 days.
//
// Run from project root:
//   npx tsx --env-file=.env.local scripts/import-events.ts

import { createClient } from '@supabase/supabase-js';

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  TICKETMASTER_API_KEY,
} = process.env;

if (
  !NEXT_PUBLIC_SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !TICKETMASTER_API_KEY
) {
  console.error(
    'Missing env vars. Run with: npx tsx --env-file=.env.local scripts/import-events.ts',
  );
  process.exit(1);
}

const supabase = createClient(
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

type SeedEntity = {
  slug: string;
  name: string;
  type: 'artist' | 'team' | 'event_brand' | 'venue';
  genre: string | null;
};

const SEEDS: SeedEntity[] = [
  { slug: 'bts', name: 'BTS', type: 'artist', genre: 'K-pop' },
  { slug: 'summer-walker', name: 'Summer Walker', type: 'artist', genre: 'R&B' },
  { slug: 'ariana-grande', name: 'Ariana Grande', type: 'artist', genre: 'Pop' },
  { slug: 'zach-bryan', name: 'Zach Bryan', type: 'artist', genre: 'Country' },
  { slug: 'the-weeknd', name: 'The Weeknd', type: 'artist', genre: 'Pop/R&B' },
  { slug: 'bad-bunny', name: 'Bad Bunny', type: 'artist', genre: 'Latin' },
  { slug: 'bruno-mars', name: 'Bruno Mars', type: 'artist', genre: 'Pop/R&B' },
  { slug: 'doja-cat', name: 'Doja Cat', type: 'artist', genre: 'Pop/Rap' },
  { slug: 'usher', name: 'Usher', type: 'artist', genre: 'R&B' },
  { slug: 'chris-brown', name: 'Chris Brown', type: 'artist', genre: 'R&B' },
  { slug: 'morgan-wallen', name: 'Morgan Wallen', type: 'artist', genre: 'Country' },
  { slug: 'luke-bryan', name: 'Luke Bryan', type: 'artist', genre: 'Country' },
  { slug: 'chris-stapleton', name: 'Chris Stapleton', type: 'artist', genre: 'Country' },
];

type TmVenue = {
  name?: string;
  city?: { name?: string };
  state?: { stateCode?: string; name?: string };
  country?: { countryCode?: string };
};

type TmEvent = {
  id: string;
  name: string;
  dates?: { start?: { localDate?: string } };
  _embedded?: { venues?: TmVenue[] };
};

type TmResponse = {
  _embedded?: { events?: TmEvent[] };
  page?: { totalElements?: number };
};

type TmImage = { url: string; width: number; height: number; ratio?: string };
type TmAttraction = { id: string; name: string; images?: TmImage[] };
type TmAttractionResponse = { _embedded?: { attractions?: TmAttraction[] } };

async function fetchAttractionImage(keyword: string): Promise<string | null> {
  const params = new URLSearchParams({
    apikey: TICKETMASTER_API_KEY!,
    keyword,
    size: '5',
  });
  const url = `https://app.ticketmaster.com/discovery/v2/attractions.json?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  attraction fetch ${res.status}: ${await res.text()}`);
    return null;
  }
  const json = (await res.json()) as TmAttractionResponse;
  const attractions = json._embedded?.attractions ?? [];
  const target = keyword.toLowerCase();
  const match =
    attractions.find((a) => a.name.toLowerCase() === target) ?? attractions[0];
  const images = match?.images ?? [];
  if (images.length === 0) return null;
  const best = [...images].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  return best.url;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 19) + 'Z';
}

async function fetchTmEvents(keyword: string): Promise<TmEvent[]> {
  const start = new Date();
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + 60);

  const params = new URLSearchParams({
    apikey: TICKETMASTER_API_KEY!,
    keyword,
    startDateTime: isoDate(start),
    endDateTime: isoDate(end),
    size: '100',
    sort: 'date,asc',
    classificationName: 'music',
  });

  const url = `https://app.ticketmaster.com/discovery/v2/events.json?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  TM API ${res.status}: ${await res.text()}`);
    return [];
  }
  const json = (await res.json()) as TmResponse;
  return json._embedded?.events ?? [];
}

async function upsertEntity(seed: SeedEntity): Promise<string | null> {
  const heroImageUrl = await fetchAttractionImage(seed.name);
  if (heroImageUrl) console.log(`  hero: ${heroImageUrl}`);

  const { data, error } = await supabase
    .from('entities')
    .upsert(
      {
        slug: seed.slug,
        name: seed.name,
        type: seed.type,
        genre: seed.genre,
        ...(heroImageUrl ? { hero_image_url: heroImageUrl } : {}),
      },
      { onConflict: 'slug' },
    )
    .select('id')
    .single();

  if (error) {
    console.error(`  entity upsert failed for ${seed.slug}:`, error.message);
    return null;
  }
  return data.id;
}

async function importEventsForEntity(
  entityId: string,
  seed: SeedEntity,
): Promise<void> {
  const tmEvents = await fetchTmEvents(seed.name);
  console.log(`  ${seed.name}: ${tmEvents.length} TM events`);

  let inserted = 0;
  for (const tm of tmEvents) {
    const date = tm.dates?.start?.localDate;
    const venue = tm._embedded?.venues?.[0];
    if (!date || !venue?.name || !venue.city?.name) continue;

    const row = {
      entity_id: entityId,
      slug: slugify(`${venue.city.name}-${venue.name}-${date}`),
      name: tm.name,
      venue_name: venue.name,
      city: venue.city.name,
      state: venue.state?.stateCode ?? venue.state?.name ?? null,
      country: venue.country?.countryCode ?? 'US',
      event_date: date,
      external_id: `tm:${tm.id}`,
    };

    const { error } = await supabase
      .from('events')
      .upsert(row, { onConflict: 'entity_id,event_date,slug' });

    if (error) {
      console.error(`    insert failed (${row.slug}):`, error.message);
      continue;
    }
    inserted++;
  }
  console.log(`    upserted ${inserted}`);
}

async function main(): Promise<void> {
  for (const seed of SEEDS) {
    console.log(`→ ${seed.name} (${seed.slug})`);
    const id = await upsertEntity(seed);
    if (!id) continue;
    await importEventsForEntity(id, seed);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
