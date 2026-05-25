// /admin/entities/new — create form.

import Link from 'next/link';
import {
  Field,
  TextareaField,
  SelectField,
  SubmitButton,
} from '@/components/admin/form-fields';
import { createEntity } from '../actions';

const TYPE_OPTIONS = [
  { value: 'artist', label: 'Artist' },
  { value: 'team', label: 'Team' },
  { value: 'event_brand', label: 'Event brand' },
  { value: 'venue', label: 'Venue' },
];

export default function NewEntityPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/admin/entities"
          className="text-sm text-gray-400 hover:text-white"
        >
          ← Entities
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">New entity</h1>
      </div>

      <form action={createEntity} className="space-y-4">
        <Field label="Name" name="name" required autoFocus />
        <Field label="Slug" name="slug" placeholder="auto-generated from name" />
        <SelectField label="Type" name="type" options={TYPE_OPTIONS} required />
        <Field label="Genre" name="genre" placeholder="e.g. Country, Pop, MLB" />
        <TextareaField label="Bio" name="bio" rows={3} />
        <Field
          label="Hero image URL"
          name="hero_image_url"
          placeholder="https://..."
          type="url"
        />
        <SubmitButton>Create</SubmitButton>
      </form>
    </div>
  );
}
