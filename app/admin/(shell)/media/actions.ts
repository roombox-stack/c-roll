'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function deleteMedia(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('media').update({ status: 'removed' }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/media');
}

export async function activateMedia(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('media').update({ status: 'active' }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/media');
}

/** Permanently hard-delete a row (no recovery). */
export async function hardDeleteMedia(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('media').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/media');
}
