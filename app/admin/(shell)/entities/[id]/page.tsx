// /admin/entities/[id] — edit form.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  Field,
  TextareaField,
  SelectField,
  CheckboxField,
  SubmitButton,
} from '@/components/admin/form-fields';
import { updateEntity } from '../actions';
import { HeroPickerClient } from './hero-picker';
import { HeroGridPicker, type HeroMediaOption } from './hero-grid-picker';
import { DangerZone } from './danger-zone';
import { SavedToast } from '@/components/admin/saved-toast';

const TYPE_OPTIONS = [
  { value: 'artist', label: 'Artist' },
  { value: 'team', label: 'Team' },
  { value: 'event_brand', label: 'Event brand' },
  { value: 'venue', label: 'Venue' },
];

export const dynamic = 'force-dynamic';

export default async function EditEntityPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { saved?: string };
}) {
  const supabase = createAdminClient();

  const [{ data: entity }, { data: mediaRows }] = await Promise.all([
    supabase.from('entities').select('*').eq('id', params.id).maybeSingle(),
    // All active media for this entity — used by both pickers.
    supabase
      .from('media')
      .select('id, file_type, storage_url, thumbnail_url, song_tag, duration_sec, view_count, event:events!inner(entity_id, city)')
      .eq('status', 'active')
      .eq('events.entity_id', params.id)
      .order('view_count', { ascending: false })
      .limit(120),
  ]);

  if (!entity) notFound();

  type RawMedia = {
    id: string;
    file_type: 'photo' | 'video';
    storage_url: string;
    thumbnail_url: string | null;
    song_tag: string | null;
    duration_sec: number | null;
    view_count: number;
    event: { entity_id: string; city: string } | { entity_id: string; city: string }[] | null;
  };

  const rawMedia = (mediaRows ?? []) as unknown as RawMedia[];

  // For the background hero image picker — photos only.
  const photoOptions = rawMedia
    .filter((m) => m.file_type === 'photo')
    .map((m) => ({
      id: m.id,
      url: m.storage_url,
      thumbnail_url: m.thumbnail_url,
    }));

  // For the hero grid picker — all media.
  const gridOptions: HeroMediaOption[] = rawMedia.map((m) => {
    const ev = Array.isArray(m.event) ? m.event[0] : m.event;
    return {
      id: m.id,
      file_type: m.file_type,
      storage_url: m.storage_url,
      thumbnail_url: m.thumbnail_url,
      song_tag: m.song_tag,
      duration_sec: m.duration_sec,
      event_city: ev?.city ?? null,
    };
  });

  const pinnedIds: string[] = Array.isArray(entity?.hero_media_ids) ? entity.hero_media_ids : [];

  return (
    <div className="max-w-4xl space-y-6">
      <SavedToast token={searchParams.saved} />
      <div>
        <Link href="/admin/entities" className="text-sm text-gray-400 hover:text-white">
          ← Entities
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{entity.name}</h1>
        <p className="text-sm text-gray-500">/{entity.slug}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left: edit form */}
        <form action={updateEntity.bind(null, entity.id)} className="space-y-4">
          <Field label="Name" name="name" defaultValue={entity.name} required />
          <Field label="Slug" name="slug" defaultValue={entity.slug} required />
          <SelectField
            label="Type"
            name="type"
            options={TYPE_OPTIONS}
            defaultValue={entity.type}
            required
          />
          <Field label="Genre" name="genre" defaultValue={entity.genre ?? ''} />
          <TextareaField label="Bio" name="bio" defaultValue={entity.bio ?? ''} rows={3} />
          <div className="flex gap-6 pt-2">
            <CheckboxField label="Verified" name="verified" defaultChecked={entity.verified} />
            <CheckboxField label="Claimed" name="claimed" defaultChecked={entity.claimed} />
          </div>
          <SubmitButton>Save</SubmitButton>
        </form>

        {/* Right: hero image picker */}
        <div className="rounded-lg border border-ash bg-smoke p-4">
          <h2 className="mb-4 text-sm font-semibold">Hero background image</h2>
          <HeroPickerClient
            entityId={entity.id}
            currentHeroUrl={entity.hero_image_url ?? null}
            mediaOptions={photoOptions}
          />
        </div>
      </div>

      {/* Hero grid picker — full width */}
      <div className="rounded-lg border border-ash bg-smoke p-4">
        <h2 className="mb-1 text-sm font-semibold">Hero grid clips</h2>
        <p className="mb-4 text-xs text-gray-500">
          Pin up to 6 clips for the &ldquo;From the floor to the upper deck&rdquo; grid.
          Leave empty to auto-select by view count.
        </p>
        <HeroGridPicker
          entityId={entity.id}
          mediaOptions={gridOptions}
          initialIds={pinnedIds}
        />
      </div>

      <DangerZone
        entityId={entity.id}
        entityName={entity.name}
        hidden={entity.hidden ?? false}
      />
    </div>
  );
}
