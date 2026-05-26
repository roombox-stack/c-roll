// Card linking to an entity page. Shows the top 3 media thumbnails as a strip,
// falling back to hero_image_url, then to a plain ash block.

import Link from 'next/link';
import Image from 'next/image';
import { BLUR_DATA_URL } from '@/lib/blur-placeholder';
import { ENTITY_TYPE_LABELS, type EntityType } from '@/lib/types';
import { formatCount } from './format';

export type EntityCardData = {
  slug: string;
  name: string;
  type: EntityType;
  follower_count: number;
  hero_image_url?: string | null;
  top_media?: Array<{ id: string; thumbnail_url: string | null }>;
};

export function EntityCard({
  entity,
  showStats = false,
}: {
  entity: EntityCardData;
  showStats?: boolean;
}) {
  const thumbs = (entity.top_media ?? []).filter((m) => m.thumbnail_url).slice(0, 3);

  return (
    <Link
      href={`/${entity.slug}`}
      className="group block overflow-hidden rounded-lg border border-ash bg-smoke transition hover:border-gray-500"
    >
      {thumbs.length === 3 ? (
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
      ) : entity.hero_image_url ? (
        <div className="relative aspect-video">
          <Image
            src={entity.hero_image_url}
            alt={entity.name}
            fill
            sizes="33vw"
            className="object-cover"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            unoptimized
          />
        </div>
      ) : (
        <div className="aspect-video bg-ash" />
      )}

      <div className="p-3">
        <div className="font-medium">{entity.name}</div>
        <div className="mt-1 text-xs text-gray-400">
          {ENTITY_TYPE_LABELS[entity.type]}
          {showStats ? ` · ${formatCount(entity.follower_count)} followers` : ''}
        </div>
      </div>
    </Link>
  );
}
