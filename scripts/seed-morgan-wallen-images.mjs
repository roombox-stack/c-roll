/**
 * Seed script: populate Morgan Wallen entity + events + media with real images.
 *
 * Run:  node scripts/seed-morgan-wallen-images.mjs
 *
 * What it does:
 *  1. Finds the morgan-wallen entity.
 *  2. Sets hero_image_url to a great wide shot.
 *  3. Finds (or creates) up to 4 events for Morgan Wallen.
 *  4. Inserts photo media rows pointing to /seed/morgan-wallen/* images
 *     so the hero grid and highlights are populated with real pictures.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iuxhlflulrpoppuwnrxg.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1eGhsZmx1bHJwb3BwdXducnhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTY3MTI2MiwiZXhwIjoyMDk1MjQ3MjYyfQ.-MKFJX3XZOBJ4R5Lq7H2B_fpYZBKgT2-mVoxsgwT8FY';

const BASE_URL = ''; // relative paths — work on localhost and production alike

// Seed images (served from /public/seed/morgan-wallen/)
const SEED_BASE = '/seed/morgan-wallen';
const IMAGES = [
  { file: 'concert-crowd.webp',   song: 'Last Night',              views: 48200, likes: 3100 },
  { file: 'live-stage.webp',      song: 'Wasted on You',           views: 39400, likes: 2700 },
  { file: 'fan-show-1.jpg',       song: 'Sand in My Boots',        views: 31000, likes: 2200 },
  { file: 'fan-show-2.jpg',       song: 'You Proof',               views: 27500, likes: 1900 },
  { file: 'fan-show-3.jpg',       song: 'More Than My Hometown',   views: 24100, likes: 1600 },
  { file: 'fan-show-4.jpg',       song: 'Whiskey Glasses',         views: 21800, likes: 1400 },
  { file: 'fan-show-5.jpg',       song: 'More Than My Hometown',   views: 19200, likes: 1300 },
  { file: 'fan-show-6.jpg',       song: 'Last Night',              views: 17500, likes: 1100 },
  { file: 'getty-stage.webp',     song: 'Cowgirls',                views: 15300, likes:  980 },
  { file: 'hat-portrait.webp',    song: 'Thought You Should Know', views: 14100, likes:  880 },
  { file: 'rolling-stone.webp',   song: 'Smile',                   views: 12900, likes:  820 },
  { file: 'promo-cover.jpg',      song: 'Wasted on You',           views: 11200, likes:  770 },
  { file: 'knoxville-billboard.webp', song: 'Sand in My Boots',    views:  9800, likes:  640 },
  { file: 'acoustic.jpg',         song: 'More Than My Hometown',   views:  8700, likes:  590 },
  { file: 'blue-tour.webp',       song: 'Cowgirls',                views:  7600, likes:  520 },
  { file: 'stadium-pointing.webp',song: 'Last Night',              views:  6500, likes:  440 },
  { file: 'vip-club-shouting.jpg',song: 'You Proof',               views:  5900, likes:  390 },
  { file: 'red-bokeh.webp',       song: 'Whiskey Glasses',         views:  5100, likes:  330 },
  { file: 'promo-2025.jpg',       song: 'I Had Some Help',         views:  4700, likes:  310 },
  { file: 'hero-road.webp',       song: 'Sand in My Boots',        views:  4200, likes:  280 },
  { file: 'tour-tickets.webp',    song: 'Thought You Should Know', views:  3800, likes:  250 },
  { file: 'promo-wide.jpg',       song: 'Cowgirls',                views:  3400, likes:  210 },
  { file: 'promo-basic.webp',     song: 'I Had Some Help',         views:  2900, likes:  180 },
];

// Events to create / ensure exist
const EVENTS_SEED = [
  { name: 'One Night At A Time Tour – Nashville',    venue_name: 'Nissan Stadium',           city: 'Nashville',    state: 'TN', event_date: '2024-08-17', slug: 'one-night-nashville-2024' },
  { name: 'One Night At A Time Tour – Knoxville',    venue_name: 'Neyland Stadium',           city: 'Knoxville',    state: 'TN', event_date: '2024-07-06', slug: 'one-night-knoxville-2024' },
  { name: "I'm the Problem Tour – Chicago",           venue_name: 'Wrigley Field',             city: 'Chicago',      state: 'IL', event_date: '2025-07-18', slug: 'itp-chicago-2025' },
  { name: "I'm the Problem Tour – Los Angeles",       venue_name: 'SoFi Stadium',              city: 'Inglewood',    state: 'CA', event_date: '2025-08-09', slug: 'itp-los-angeles-2025' },
];

// Media spread across events (index → event index)
const EVENT_SPREAD = [0,0,0,0,0,0, 1,1,1,1, 2,2,2,2,2, 3,3,3,3,3,3,3,3];

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
  // 1. Find entity
  const { data: entity, error: eErr } = await supabase
    .from('entities')
    .select('id, slug, name, hero_image_url')
    .eq('slug', 'morgan-wallen')
    .maybeSingle();

  if (eErr || !entity) {
    console.error('Entity not found. Create it first in /admin/entities.', eErr);
    process.exit(1);
  }
  console.log(`Found entity: ${entity.name} (${entity.id})`);

  // 2. Update hero image
  // Use a full absolute URL for the hero (it's used in OG meta tags which need absolute URLs).
  // For the media rows we'll use relative paths that work on any domain.
  const heroImage = `${SEED_BASE}/concert-crowd.webp`;
  const { error: heroErr } = await supabase
    .from('entities')
    .update({ hero_image_url: heroImage })
    .eq('id', entity.id);
  if (heroErr) console.error('Hero update failed:', heroErr);
  else console.log('✓ Hero image updated');

  // 3. Upsert events
  const eventIds = [];
  for (const ev of EVENTS_SEED) {
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('slug', ev.slug)
      .maybeSingle();

    if (existing) {
      console.log(`  Event exists: ${ev.slug} → ${existing.id}`);
      eventIds.push(existing.id);
      continue;
    }

    const { data: created, error: evErr } = await supabase
      .from('events')
      .insert({
        entity_id: entity.id,
        slug: ev.slug,
        name: ev.name,
        venue_name: ev.venue_name,
        city: ev.city,
        state: ev.state,
        event_date: ev.event_date,
        upload_count: 0,
      })
      .select('id')
      .single();

    if (evErr || !created) {
      console.error(`  Failed to create event ${ev.slug}:`, evErr);
      eventIds.push(null);
    } else {
      console.log(`  Created event: ${ev.slug} → ${created.id}`);
      eventIds.push(created.id);
    }
  }

  // 4. Delete old seed media for this entity (to avoid dupes on re-run)
  const { error: delErr } = await supabase
    .from('media')
    .delete()
    .eq('entity_id', entity.id)
    .like('storage_url', '%/seed/%');
  if (delErr) console.error('Cleanup error:', delErr);
  else console.log('✓ Cleared previous seed media');

  // 5. Insert media rows
  const toInsert = IMAGES.map((img, i) => {
    const eventIdx = EVENT_SPREAD[i] ?? 0;
    const eventId = eventIds[eventIdx];
    const url = `${BASE_URL}${SEED_BASE}/${img.file}`;
    return {
      entity_id: entity.id,
      event_id: eventId,
      file_type: 'photo',
      storage_url: url,
      thumbnail_url: url,
      status: 'active',
      song_tag: img.song,
      section_tag: i % 3 === 0 ? 'floor' : i % 3 === 1 ? 'section_100' : 'section_200',
      is_full_song: false,
      view_count: img.views,
      like_count: img.likes,
    };
  });

  const { data: inserted, error: insErr } = await supabase
    .from('media')
    .insert(toInsert)
    .select('id');

  if (insErr) {
    console.error('Insert failed:', insErr);
    process.exit(1);
  }
  console.log(`✓ Inserted ${inserted?.length ?? 0} media rows`);

  // 6. Update upload_count on events
  for (const eventId of eventIds.filter(Boolean)) {
    const { count } = await supabase
      .from('media')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);
    await supabase
      .from('events')
      .update({ upload_count: count ?? 0 })
      .eq('id', eventId);
  }
  console.log('✓ Upload counts synced');

  console.log('\nAll done! Visit http://localhost:3000/morgan-wallen to see the result.');
}

run().catch(console.error);
