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

const TYPE_OPTIONS = [
  { value: 'artist', label: 'Artist' },
  { value: 'team', label: 'Team' },
  { value: 'event_brand', label: 'Event brand' },
  { value: 'venue', label: 'Venue' },
];

export const dynamic = 'force-dynamic';

export default async function EditEntityPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();

  const [{ data: entity }, { data: mediaRows }] = await Promise.all([
    supabase.from('entities').select('*').eq('id', params.id).maybeSingle(),
    supabase
      .from('media')
      .select('id, storage_url, thumbnail_url, event:events!inner(entity_id)')
      .eq('file_type', 'photo')
      .eq('status', 'active')
      .eq('events.entity_id', params.id)
      .order('view_count', { ascending: false })
      .limit(60),
  ]);

  if (!entity) notFound();

  const mediaOptions = (mediaRows ?? []).map((m: any) => ({
    id: m.id,
    url: m.storage_url as string,
    thumbnail_url: m.thumbnail_url as string | null,
  }));

  return (
    <div className="max-w-4xl space-y-6">
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
            mediaOptions={mediaOptions}
          />
        </div>
      </div>
    </div>
  );
}
