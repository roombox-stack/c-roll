-- Showside seed data - entities and a handful of real-world events.
-- Idempotent: re-running won't duplicate (uses upserts on slug / unique keys).
-- Apply after 0001_init.sql via Supabase dashboard → SQL editor.

-- ─── Entities ────────────────────────────────────────────────────────────────
insert into public.entities (slug, name, type, genre, verified, bio)
values
  ('morgan-wallen',         'Morgan Wallen',         'artist',      'Country',  true,
   'Country artist known for stadium tours and a string of #1 country radio hits.'),
  ('taylor-swift',          'Taylor Swift',          'artist',      'Pop',      true,
   'Pop artist. The Eras Tour reshaped the live music industry.'),
  ('philadelphia-phillies', 'Philadelphia Phillies', 'team',        'MLB',      true,
   'Major League Baseball team based in Philadelphia, Pennsylvania.'),
  ('kentucky-derby',        'Kentucky Derby',        'event_brand', 'Horse Racing', true,
   'Annual Grade I stakes race held at Churchill Downs on the first Saturday in May.')
on conflict (slug) do update
  set name = excluded.name,
      type = excluded.type,
      genre = excluded.genre,
      verified = excluded.verified,
      bio = excluded.bio;

-- ─── Events ──────────────────────────────────────────────────────────────────
-- Morgan Wallen
insert into public.events (entity_id, slug, name, venue_name, city, state, country, event_date, tour_name)
select id, 'morgan-wallen-gillette-stadium-boston-2026-05-10',
       'Morgan Wallen - Gillette Stadium', 'Gillette Stadium', 'Foxborough', 'MA', 'US',
       '2026-05-10', 'I''m The Problem Tour'
from public.entities where slug = 'morgan-wallen'
on conflict (entity_id, event_date, slug) do nothing;

insert into public.events (entity_id, slug, name, venue_name, city, state, country, event_date, tour_name)
select id, 'morgan-wallen-soldier-field-chicago-2026-06-13',
       'Morgan Wallen - Soldier Field', 'Soldier Field', 'Chicago', 'IL', 'US',
       '2026-06-13', 'I''m The Problem Tour'
from public.entities where slug = 'morgan-wallen'
on conflict (entity_id, event_date, slug) do nothing;

insert into public.events (entity_id, slug, name, venue_name, city, state, country, event_date, tour_name)
select id, 'morgan-wallen-att-stadium-dallas-2026-07-18',
       'Morgan Wallen - AT&T Stadium', 'AT&T Stadium', 'Arlington', 'TX', 'US',
       '2026-07-18', 'I''m The Problem Tour'
from public.entities where slug = 'morgan-wallen'
on conflict (entity_id, event_date, slug) do nothing;

-- Taylor Swift
insert into public.events (entity_id, slug, name, venue_name, city, state, country, event_date, tour_name)
select id, 'taylor-swift-sofi-stadium-la-2025-08-09',
       'Taylor Swift - SoFi Stadium', 'SoFi Stadium', 'Inglewood', 'CA', 'US',
       '2025-08-09', 'The Eras Tour'
from public.entities where slug = 'taylor-swift'
on conflict (entity_id, event_date, slug) do nothing;

insert into public.events (entity_id, slug, name, venue_name, city, state, country, event_date, tour_name)
select id, 'taylor-swift-metlife-stadium-2025-05-26',
       'Taylor Swift - MetLife Stadium', 'MetLife Stadium', 'East Rutherford', 'NJ', 'US',
       '2025-05-26', 'The Eras Tour'
from public.entities where slug = 'taylor-swift'
on conflict (entity_id, event_date, slug) do nothing;

-- Philadelphia Phillies
insert into public.events (entity_id, slug, name, venue_name, city, state, country, event_date, tour_name)
select id, 'phillies-vs-mets-citizens-bank-park-2026-04-15',
       'Phillies vs. Mets - Citizens Bank Park', 'Citizens Bank Park', 'Philadelphia', 'PA', 'US',
       '2026-04-15', null
from public.entities where slug = 'philadelphia-phillies'
on conflict (entity_id, event_date, slug) do nothing;

insert into public.events (entity_id, slug, name, venue_name, city, state, country, event_date, tour_name)
select id, 'phillies-opening-day-2026-03-28',
       'Phillies Opening Day - Citizens Bank Park', 'Citizens Bank Park', 'Philadelphia', 'PA', 'US',
       '2026-03-28', null
from public.entities where slug = 'philadelphia-phillies'
on conflict (entity_id, event_date, slug) do nothing;

-- Kentucky Derby
insert into public.events (entity_id, slug, name, venue_name, city, state, country, event_date, tour_name)
select id, 'kentucky-derby-152-churchill-downs-2026-05-02',
       'Kentucky Derby 152', 'Churchill Downs', 'Louisville', 'KY', 'US',
       '2026-05-02', null
from public.entities where slug = 'kentucky-derby'
on conflict (entity_id, event_date, slug) do nothing;

insert into public.events (entity_id, slug, name, venue_name, city, state, country, event_date, tour_name)
select id, 'kentucky-derby-151-churchill-downs-2025-05-03',
       'Kentucky Derby 151', 'Churchill Downs', 'Louisville', 'KY', 'US',
       '2025-05-03', null
from public.entities where slug = 'kentucky-derby'
on conflict (entity_id, event_date, slug) do nothing;
