'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  ALLOWED_PHOTO_TYPES,
  createPhotoUploadUrl,
  photoKey,
  publicUrlForKey,
} from '@/lib/r2';
import { createDirectUpload } from '@/lib/mux';

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
    .slice(0, 80);
}

const ALLOWED_TYPES = new Set(['artist', 'team', 'event_brand', 'venue']);

export async function createEntity(formData: FormData) {
  const name = getField(formData, 'name');
  const slugInput = getField(formData, 'slug');
  const type = getField(formData, 'type');
  const genre = getField(formData, 'genre');
  const bio = getField(formData, 'bio');
  const hero_image_url = getField(formData, 'hero_image_url');

  if (!name) throw new Error('name is required');
  if (!ALLOWED_TYPES.has(type)) throw new Error('invalid type');

  const slug = slugInput || slugify(name);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('entities')
    .insert({
      name,
      slug,
      type,
      genre: genre || null,
      bio: bio || null,
      hero_image_url: hero_image_url || null,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  revalidatePath('/admin/entities');
  redirect(`/admin/entities/${data.id}`);
}

export async function setHeroMediaIds(entityId: string, ids: string[]) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('entities')
    .update({ hero_media_ids: ids.length > 0 ? ids.slice(0, 6) : null })
    .eq('id', entityId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/entities/${entityId}`);
  revalidatePath('/admin/entities');
}

export async function setHeroImage(entityId: string, heroImageUrl: string | null) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('entities')
    .update({ hero_image_url: heroImageUrl || null })
    .eq('id', entityId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/entities/${entityId}`);
  revalidatePath('/admin/entities');
}

export async function updateEntity(id: string, formData: FormData) {
  const name = getField(formData, 'name');
  const slug = getField(formData, 'slug');
  const type = getField(formData, 'type');
  const genre = getField(formData, 'genre');
  const bio = getField(formData, 'bio');
  const verified = formData.get('verified') === 'on';
  const claimed = formData.get('claimed') === 'on';
  const hidden = formData.get('hidden') === 'on';

  if (!name) throw new Error('name is required');
  if (!slug) throw new Error('slug is required');
  if (!ALLOWED_TYPES.has(type)) throw new Error('invalid type');

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('entities')
    .update({
      name,
      slug,
      type,
      genre: genre || null,
      bio: bio || null,
      verified,
      claimed,
      hidden,
    })
    .eq('id', id);

  if (error) throw new Error(error.message);

  revalidatePath('/admin/entities');
  revalidatePath(`/admin/entities/${id}`);
  // Redirect back with a changing token so the page shows a "saved" toast.
  redirect(`/admin/entities/${id}?saved=${Date.now()}`);
}

export async function hideEntity(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('entities').update({ hidden: true }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/entities');
  revalidatePath(`/admin/entities/${id}`);
  redirect(`/admin/entities/${id}?saved=${Date.now()}`);
}

export async function unhideEntity(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('entities').update({ hidden: false }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/entities');
  revalidatePath(`/admin/entities/${id}`);
  redirect(`/admin/entities/${id}?saved=${Date.now()}`);
}

// ─── Admin upload helpers ─────────────────────────────────────────────────────

/** Presign an R2 PUT URL for a photo. Creates the media row in status=uploading. */
export async function adminPresignPhoto(
  eventId: string,
  filename: string,
  contentType: string,
): Promise<{ mediaId: string; uploadUrl: string; storageUrl: string }> {
  if (!ALLOWED_PHOTO_TYPES.has(contentType.toLowerCase())) {
    throw new Error(`unsupported content type: ${contentType}`);
  }
  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from('events')
    .select('id, entity_id')
    .eq('id', eventId)
    .single();
  if (!event) throw new Error('event not found');

  const { data: media, error: insertErr } = await supabase
    .from('media')
    .insert({
      event_id: event.id,
      entity_id: event.entity_id,
      file_type: 'photo',
      storage_url: '',
      status: 'uploading',
    })
    .select('id')
    .single();
  if (insertErr || !media) throw new Error('failed to create media row');

  const key = photoKey(event.id, media.id, filename);
  const storageUrl = publicUrlForKey(key);

  await supabase.from('media').update({ storage_url: storageUrl }).eq('id', media.id);

  const uploadUrl = await createPhotoUploadUrl({ key, contentType: contentType.toLowerCase() });
  return { mediaId: media.id, uploadUrl, storageUrl };
}

/** Create a Mux direct upload and a media row in status=uploading. */
export async function adminPresignVideo(
  eventId: string,
): Promise<{ mediaId: string; uploadUrl: string; muxUploadId: string }> {
  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from('events')
    .select('id, entity_id')
    .eq('id', eventId)
    .single();
  if (!event) throw new Error('event not found');

  const mux = await createDirectUpload();

  const { data: media, error: insertErr } = await supabase
    .from('media')
    .insert({
      event_id: event.id,
      entity_id: event.entity_id,
      file_type: 'video',
      storage_url: '',
      mux_upload_id: mux.uploadId,
      status: 'uploading',
    })
    .select('id')
    .single();
  if (insertErr || !media) throw new Error('failed to create media row');

  return { mediaId: media.id, uploadUrl: mux.uploadUrl, muxUploadId: mux.uploadId };
}

/** Flip a photo from status=uploading → active. (Videos are activated by the Mux webhook.) */
export async function adminActivateMedia(mediaId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('media')
    .update({ status: 'active' })
    .eq('id', mediaId)
    .eq('file_type', 'photo'); // videos are handled by Mux webhook
  if (error) throw new Error(error.message);
  revalidatePath('/admin/entities', 'layout');
}

// ─── Entity CRUD ──────────────────────────────────────────────────────────────

export async function deleteEntity(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('entities').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/entities');
  redirect('/admin/entities');
}
