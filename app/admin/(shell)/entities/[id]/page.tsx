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

const TYPE_OPTIONS = [
  { value: 'artist', label: 'Artist' },
  { value: 'team', label: 'Team' },
  { value: 'event_brand', label: 'Event brand' },
  { value: 'venue', label: 'Venue' },
];

export const dynamic = 'force-dynamic';

export default async function EditEntityPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const { data: entity } = await supabase
    .from('entities')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!entity) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/entities" className="text-sm text-gray-400 hover:text-white">
          ← Entities
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{entity.name}</h1>
        <p className="text-sm text-gray-500">/{entity.slug}</p>
      </div>

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
        <Field
          label="Hero image URL"
          name="hero_image_url"
          defaultValue={entity.hero_image_url ?? ''}
          type="url"
        />
        <div className="flex gap-6 pt-2">
          <CheckboxField label="Verified" name="verified" defaultChecked={entity.verified} />
          <CheckboxField label="Claimed" name="claimed" defaultChecked={entity.claimed} />
        </div>
        <SubmitButton>Save</SubmitButton>
      </form>
    </div>
  );
}
