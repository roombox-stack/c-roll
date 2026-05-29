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
import { updateEntity, hideEntity, unhideEntity, deleteEntity } from '../actions';
import { HeroPickerClient } from './hero-picker';
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
            mediaOptions={mediaOptions}
          />
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-red-400">Danger zone</h2>
        <div className="flex flex-wrap items-center gap-4">
          {/* Hide / unhide */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white">
              {entity.hidden ? 'This entity is hidden from the public site.' : 'Hide from public site'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {entity.hidden
                ? 'Re-publish it to make it visible again.'
                : 'The page and all its events stay in the DB — only you can see them.'}
            </p>
          </div>
          {entity.hidden ? (
            <form action={unhideEntity.bind(null, entity.id)}>
              <button
                type="submit"
                className="rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-500/20 transition"
              >
                Unhide (re-publish)
              </button>
            </form>
          ) : (
            <form action={hideEntity.bind(null, entity.id)}>
              <button
                type="submit"
                className="rounded border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-400 hover:bg-yellow-500/20 transition"
              >
                Hide entity
              </button>
            </form>
          )}
        </div>

        <hr className="border-red-900/30" />

        {/* Delete */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white">Delete entity permanently</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Removes the entity and all associated events from the database. This cannot be undone.
            </p>
          </div>
          <form
            action={deleteEntity.bind(null, entity.id)}
            onSubmit={(e) => {
              if (!confirm(`Permanently delete "${entity.name}"? This cannot be undone.`)) {
                e.preventDefault();
              }
            }}
          >
            <button
              type="submit"
              className="rounded border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 transition"
            >
              Delete entity
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
