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

const MAX_SONG_TAG = 120;

function normalizeSongTag(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  return t.slice(0, MAX_SONG_TAG);
}

/** Set song_tag on a single media row. Pass null to clear.
 *  Song tags are only allowed on videos — photos are silently skipped. */
export async function setSongTag(id: string, songTag: string | null) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('media')
    .update({ song_tag: normalizeSongTag(songTag) })
    .eq('id', id)
    .eq('file_type', 'video'); // photos never get song tags
  if (error) throw new Error(error.message);
  revalidatePath('/admin/media');
  revalidatePath('/admin/moderation');
}

/** Set (or clear) the event association on a media row. */
export async function setMediaEvent(id: string, eventId: string | null) {
  const supabase = createAdminClient();
  // When attaching to a new event, also sync entity_id from the event.
  if (eventId) {
    const { data: event } = await supabase
      .from('events')
      .select('id, entity_id')
      .eq('id', eventId)
      .single();
    if (!event) throw new Error('event not found');
    const { error } = await supabase
      .from('media')
      .update({ event_id: event.id, entity_id: event.entity_id })
      .eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('media')
      .update({ event_id: null })
      .eq('id', id);
    if (error) {
      // Likely means migration 0018 hasn't been applied yet.
      if (error.message.includes('not-null') || error.message.includes('violates not-null')) {
        throw new Error('Cannot clear event: run migration 0018_nullable_event_id.sql in Supabase first.');
      }
      throw new Error(error.message);
    }
  }
  revalidatePath('/admin/media');
}

/** Set section_tag on a single media row. Pass null to clear. */
export async function setSectionTag(id: string, sectionTag: string | null) {
  const supabase = createAdminClient();
  const normalized = sectionTag?.trim() || null;
  const { error } = await supabase
    .from('media')
    .update({ section_tag: normalized })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/media');
}

/**
 * Apply song_tag to multiple media rows in one server action call. Used by
 * the per-event "Tag Media" bulk editor. Caller passes only the rows that
 * actually changed, so this stays cheap.
 */
export async function bulkSetSongTags(
  updates: Array<{ id: string; song_tag: string | null }>,
) {
  if (updates.length === 0) return { updated: 0 };
  const supabase = createAdminClient();

  // PostgREST has no batch-update-with-different-values primitive, so we do
  // one update per row. Volumes here are small (admin only, per-event).
  let updated = 0;
  for (const u of updates) {
    const { error } = await supabase
      .from('media')
      .update({ song_tag: normalizeSongTag(u.song_tag) })
      .eq('id', u.id);
    if (error) throw new Error(error.message);
    updated += 1;
  }

  revalidatePath('/admin/media');
  revalidatePath('/admin/moderation');
  revalidatePath('/admin/events', 'layout');
  return { updated };
}
