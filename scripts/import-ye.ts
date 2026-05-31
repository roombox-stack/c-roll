// scripts/import-ye.ts
//
// One-off: add Ye (Kanye West) as an entity and import all of his upcoming
// Ticketmaster shows worldwide through end of year (no country filter,
// extended date range vs. the standard 60-day import).
//
//   npx tsx --env-file=.env.local scripts/import-ye.ts

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
  console.error('Missing env vars.');
  process.exit(1);
}

const supabase = createClient(
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const SEARCH_KEYWORD = 'Kanye West'; // TM attraction is still listed under this
const ENTITY = {
  slug: 'ye',
  name: 'Ye',
  type: 'artist' as const,
  genre: 'Hip-Hop',
};

type TmImage = { url: string; width: number; height: number };
type TmAttraction = { id: string; name: string; images?: TmImage[] };
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
  _embedded?: { venues?: TmVenue[]; attractions?: TmAttraction[] };
};

function slugify(s: string): string {
  return s
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

async function findAttraction(): Promise<TmAttraction | null> {
  const params = new URLSearchParams({
    apikey: TICKETMASTER_API_KEY!,
    keyword: SEARCH_KEYWORD,
    size: '10',
  });
  const res = await fetch(
    `https://app.ticketmaster.com/discovery/v2/attractions.json?${params}`,
  );
  if (!res.ok) {
    console.error(`attraction fetch ${res.status}: ${await res.text()}`);
    return null;
  }
  const json = (await res.json()) as {
    _embedded?: { attractions?: TmAttraction[] };
  };
  const list = json._embedded?.attractions ?? [];
  // Prefer exact name match on "Kanye West" or "Ye"
  return (
    list.find((a) => /^(kanye west|ye)$/i.test(a.name)) ?? list[0] ?? null
  );
}

function bestImage(images: TmImage[] | undefined): string | null {
  if (!images?.length) return null;
  return [...images].sort((a, b) => b.width * b.height - a.width * a.height)[0]
    .url;
}

async function fetchEventsByAttraction(attractionId: string): Promise<TmEvent[]> {
  const start = new Date();
  const end = new Date(`${new Date().getUTCFullYear()}-12-31T23:59:59Z`);

  const all: TmEvent[] = [];
  let page = 0;
  while (true) {
    const params = new URLSearchParams({
      apikey: TICKETMASTER_API_KEY!,
      attractionId,
      startDateTime: isoDate(start),
      endDateTime: isoDate(end),
      size: '100',
      page: String(page),
      sort: 'date,asc',
    });
    const res = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?${params}`,
    );
    if (!res.ok) {
      console.error(`events fetch ${res.status}: ${await res.text()}`);
      break;
    }
    const json = (await res.json()) as {
      _embedded?: { events?: TmEvent[] };
      page?: { totalPages?: number };
    };
    const events = json._embedded?.events ?? [];
    all.push(...events);
    const totalPages = json.page?.totalPages ?? 1;
    if (page + 1 >= totalPages) break;
    page++;
  }
  return all;
}

async function main(): Promise<void> {
  const attr = await findAttraction();
  if (!attr) {
    console.error('No TM attraction found for Kanye West / Ye');
    process.exit(1);
  }
  console.log(`Attraction: ${attr.name} (${attr.id})`);
  const heroImageUrl = bestImage(attr.images);
  if (heroImageUrl) console.log(`Hero: ${heroImageUrl}`);

  const { data: entity, error: entErr } = await supabase
    .from('entities')
    .upsert(
      {
        slug: ENTITY.slug,
        name: ENTITY.name,
        type: ENTITY.type,
        genre: ENTITY.genre,
        ...(heroImageUrl ? { hero_image_url: heroImageUrl } : {}),
      },
      { onConflict: 'slug' },
    )
    .select('id')
    .single();
  if (entErr || !entity) {
    console.error('entity upsert failed:', entErr?.message);
    process.exit(1);
  }

  const events = await fetchEventsByAttraction(attr.id);
  console.log(`Found ${events.length} events through end of year`);

  let upserted = 0;
  const byCountry = new Map<string, number>();
  for (const tm of events) {
    const date = tm.dates?.start?.localDate;
    const venue = tm._embedded?.venues?.[0];
    if (!date || !venue?.name || !venue.city?.name) continue;

    const country = venue.country?.countryCode ?? 'US';
    byCountry.set(country, (byCountry.get(country) ?? 0) + 1);

    const row = {
      entity_id: entity.id,
      slug: slugify(`${venue.city.name}-${venue.name}-${date}`),
      name: tm.name,
      venue_name: venue.name,
      city: venue.city.name,
      state: venue.state?.stateCode ?? venue.state?.name ?? null,
      country,
      event_date: date,
      external_id: `tm:${tm.id}`,
    };

    const { error } = await supabase
      .from('events')
      .upsert(row, { onConflict: 'entity_id,event_date,slug' });
    if (error) {
      console.error(`  insert failed (${row.slug}):`, error.message);
      continue;
    }
    upserted++;
  }
  console.log(`Upserted ${upserted} events.`);
  console.log('By country:', Object.fromEntries(byCountry));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
