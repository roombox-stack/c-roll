'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function approveMedia(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('media')
    .update({ status: 'active' })
    .eq('id', id)
    .eq('status', 'pending_review');
  if (error) throw new Error(error.message);
  revalidatePath('/admin/moderation');
}

export async function removeMedia(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('media')
    .update({ status: 'removed' })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/moderation');
}

export async function bulkApproveAll() {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('media')
    .update({ status: 'active' })
    .eq('status', 'pending_review');
  if (error) throw new Error(error.message);
  revalidatePath('/admin/moderation');
}
