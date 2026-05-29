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

export async function deleteEntity(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('entities').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/entities');
  redirect('/admin/entities');
}
