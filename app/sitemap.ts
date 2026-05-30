// Dynamic sitemap — Next.js calls this on /sitemap.xml.
//
// Includes: home, search, every entity page, every event page.
// Uses the admin Supabase client (server-only) so RLS doesn't filter rows.

import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const supabase = createAdminClient();

  const [entitiesRes, eventsRes] = await Promise.all([
    supabase.from('entities').select('slug, created_at').eq('hidden', false),
    supabase
      .from('events')
      .select('slug, created_at, entity:entities(slug)')
      .eq('hidden', false),
  ]);

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/search`, changeFrequency: 'weekly', priority: 0.3 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/contact`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: 'monthly', priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: 'monthly', priority: 0.2 },
    { url: `${base}/dmca`, changeFrequency: 'monthly', priority: 0.2 },
    { url: `${base}/claim`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  for (const e of entitiesRes.data ?? []) {
    entries.push({
      url: `${base}/${e.slug}`,
      lastModified: e.created_at ? new Date(e.created_at) : undefined,
      changeFrequency: 'daily',
      priority: 0.9,
    });
  }

  for (const ev of (eventsRes.data ?? []) as unknown as Array<{
    slug: string;
    created_at: string | null;
    entity: { slug: string } | { slug: string }[] | null;
  }>) {
    const entity = Array.isArray(ev.entity) ? ev.entity[0] : ev.entity;
    if (!entity) continue;
    entries.push({
      url: `${base}/${entity.slug}/${ev.slug}`,
      lastModified: ev.created_at ? new Date(ev.created_at) : undefined,
      changeFrequency: 'daily',
      priority: 0.8,
    });
  }

  return entries;
}
