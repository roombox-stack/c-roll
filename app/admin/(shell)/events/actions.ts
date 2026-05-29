'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

function getField(fd: FormData, name: string): string {
  return String(fd.get(name) ?? '').trim();
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/** Split a textarea blob into an array of song names. Trims, drops blanks. */
function parseSetlist(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function createEvent(formData: FormData) {
  const entity_id = getField(formData, 'entity_id');
  const nameInput = getField(formData, 'name');
  const slugInput = getField(formData, 'slug');
  const venue_name = getField(formData, 'venue_name');
  const city = getField(formData, 'city');
  const state = getField(formData, 'state');
  const country = getField(formData, 'country') || 'US';
  const event_date = getField(formData, 'event_date');
  const tour_name = getField(formData, 'tour_name');
  const setlistRaw = getField(formData, 'setlist');

  if (!entity_id) throw new Error('entity is required');
  if (!venue_name) throw new Error('venue_name is required');
  if (!city) throw new Error('city is required');
  if (!event_date) throw new Error('event_date is required');

  const supabase = createAdminClient();
  const { data: entity, error: entErr } = await supabase
    .from('entities')
    .select('name, slug')
    .eq('id', entity_id)
    .maybeSingle();
  if (entErr) throw new Error(entErr.message);
  if (!entity) throw new Error('entity not found');

  const name = nameInput || `${entity.name} - ${venue_name}`;
  const slug =
    slugInput || slugify(`${entity.slug}-${venue_name}-${city}-${event_date}`);
  const setlist = setlistRaw ? parseSetlist(setlistRaw) : null;

  const { data, error } = await supabase
    .from('events')
    .insert({
      entity_id,
      slug,
      name,
      venue_name,
      city,
      state: state || null,
      country,
      event_date,
      tour_name: tour_name || null,
      setlist,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  revalidatePath('/admin/events');
  redirect(`/admin/events/${data.id}`);
}

export async function updateEvent(id: string, formData: FormData) {
  const name = getField(formData, 'name');
  const slug = getField(formData, 'slug');
  const venue_name = getField(formData, 'venue_name');
  const city = getField(formData, 'city');
  const state = getField(formData, 'state');
  const country = getField(formData, 'country') || 'US';
  const event_date = getField(formData, 'event_date');
  const tour_name = getField(formData, 'tour_name');
  const setlistRaw = getField(formData, 'setlist');

  if (!name) throw new Error('name is required');
  if (!slug) throw new Error('slug is required');
  if (!venue_name) throw new Error('venue_name is required');
  if (!city) throw new Error('city is required');
  if (!event_date) throw new Error('event_date is required');

  const setlist = setlistRaw ? parseSetlist(setlistRaw) : null;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('events')
    .update({
      slug,
      name,
      venue_name,
      city,
      state: state || null,
      country,
      event_date,
      tour_name: tour_name || null,
      setlist,
    })
    .eq('id', id);

  if (error) throw new Error(error.message);

  revalidatePath('/admin/events');
  revalidatePath(`/admin/events/${id}`);
  // Redirect back with a changing token so the page shows a "saved" toast.
  redirect(`/admin/events/${id}?saved=${Date.now()}`);
}
