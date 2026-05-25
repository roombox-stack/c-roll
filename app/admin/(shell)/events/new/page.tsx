// /admin/events/new — create form.

import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  Field,
  TextareaField,
  SelectField,
  SubmitButton,
} from '@/components/admin/form-fields';
import { createEvent } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewEventPage() {
  const supabase = createAdminClient();
  const { data: entities } = await supabase
    .from('entities')
    .select('id, name')
    .order('name');
  const entityOptions = (entities ?? []).map((e) => ({ value: e.id, label: e.name }));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/events" className="text-sm text-gray-400 hover:text-white">
          ← Events
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">New event</h1>
      </div>

      <form action={createEvent} className="space-y-4">
        <SelectField
          label="Entity"
          name="entity_id"
          options={entityOptions}
          required
          autoFocus
        />
        <Field label="Name" name="name" placeholder="auto-generated from entity + venue" />
        <Field label="Slug" name="slug" placeholder="auto-generated" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Venue name" name="venue_name" required />
          <Field label="Event date" name="event_date" type="date" required />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="City" name="city" required />
          <Field label="State" name="state" placeholder="MA" />
          <Field label="Country" name="country" defaultValue="US" />
        </div>
        <Field label="Tour name" name="tour_name" placeholder="optional" />
        <TextareaField
          label="Setlist (one song per line, in order)"
          name="setlist"
          rows={10}
          placeholder={'Last Night\n7 Summers\nWhiskey Glasses\n…'}
        />
        <SubmitButton>Create</SubmitButton>
      </form>
    </div>
  );
}
