// Build a map of eventId → Mux thumbnail URL for the most-viewed active
// video on each event. Used by show-card components so each card can render
// a real fan-shot thumbnail as its background instead of a gradient.
//
// One query, grouped client-side — no extra Mux API call, the thumbnail URL
// is a deterministic function of the playback_id.

import { createAdminClient } from '@/lib/supabase/admin';

export function muxThumbnailUrl(playbackId: string): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg`;
}

/**
 * Returns Map<eventId, thumbnailUrl> for the most-viewed active video on
 * each given event. Events without any active video are simply absent from
 * the map — callers fall back to whatever their non-image treatment is.
 */
export async function fetchEventHeroThumbs(
  eventIds: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (eventIds.length === 0) return out;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('media')
    .select('event_id, mux_playback_id, view_count')
    .in('event_id', eventIds)
    .eq('status', 'active')
    .eq('file_type', 'video')
    .not('mux_playback_id', 'is', null)
    .order('view_count', { ascending: false });

  // The query returns rows sorted globally by view_count; the first row we
  // encounter per event_id is therefore the most-viewed video for that event.
  for (const row of (data ?? []) as Array<{
    event_id: string;
    mux_playback_id: string | null;
    view_count: number;
  }>) {
    if (!row.mux_playback_id) continue;
    if (out.has(row.event_id)) continue;
    out.set(row.event_id, muxThumbnailUrl(row.mux_playback_id));
  }
  return out;
}
