// Card linking to a specific show. Shows date prominently + a thumbnail strip
// of the most recent uploads from that show.

import Link from 'next/link';
import Image from 'next/image';
import { BLUR_DATA_URL } from '@/lib/blur-placeholder';
import { formatCount, formatEventDate } from './format';

export type EventCardData = {
  id: string;
  slug: string;
  name: string;
  venue_name: string;
  city: string;
  state?: string | null;
  event_date: string;
  upload_count: number;
  entity: { slug: string; name: string };
  recent_media?: Array<{ id: string; thumbnail_url: string | null }>;
  /**
   * Mux thumbnail URL for the most-viewed active video on this event,
   * supplied by the page via fetchEventHeroThumbs(). Takes precedence over
   * the 3-up recent_media strip when present.
   */
  hero_thumb_url?: string | null;
};

export function EventCard({
  event,
  showEntityName = false,
}: {
  event: EventCardData;
  showEntityName?: boolean;
}) {
  const thumbs = (event.recent_media ?? []).filter((m) => m.thumbnail_url).slice(0, 3);

  return (
    <Link
      href={`/${event.entity.slug}/${event.slug}`}
      className="group block overflow-hidden rounded-lg border border-ash bg-smoke transition hover:border-gray-500"
    >
      {event.hero_thumb_url ? (
        <div className="relative aspect-video bg-ash">
          <Image
            src={event.hero_thumb_url}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-cover transition group-hover:scale-105"
            unoptimized
          />
        </div>
      ) : thumbs.length === 3 ? (
        <div className="grid grid-cols-3 gap-px bg-ash">
          {thumbs.map((m) => (
            <div key={m.id} className="relative aspect-square">
              <Image
                src={m.thumbnail_url!}
                alt=""
                fill
                sizes="120px"
                className="object-cover"
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                unoptimized
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="aspect-video bg-ash" />
      )}

      <div className="p-3 text-sm">
        <div className="text-xs uppercase tracking-wider text-gray-400">
          {formatEventDate(event.event_date)}
        </div>
        {showEntityName ? (
          <div className="text-xs text-gray-500">{event.entity.name}</div>
        ) : null}
        <div className="mt-0.5 font-medium">{event.venue_name}</div>
        <div className="text-xs text-gray-400">
          {event.city}
          {event.state ? `, ${event.state}` : ''}
          {' · '}
          {formatCount(event.upload_count)} uploads
        </div>
      </div>
    </Link>
  );
}
