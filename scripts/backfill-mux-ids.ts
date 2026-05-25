// scripts/backfill-mux-ids.ts
//
// One-off: list every Mux video asset and, for each one that's ready,
// patch the matching `media` row in Supabase with the fields the
// /api/mux/webhook handler would have written:
//   • mux_asset_id
//   • mux_playback_id
//   • thumbnail_url
//   • duration_sec
//   • storage_url (HLS)
//   • is_full_song (duration >= 150s)
//   • status = 'active'
//
// Matching is by mux_upload_id, which was saved when the upload URL was
// originally created. Rows that already have a playback_id are skipped so
// re-running the script is safe.
//
// Run from project root (Node 22+ recommended):
//   npx tsx --env-file=.env.local scripts/backfill-mux-ids.ts

import Mux from '@mux/mux-node';
import { createClient } from '@supabase/supabase-js';

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  MUX_TOKEN_ID,
  MUX_TOKEN_SECRET,
} = process.env;

if (
  !NEXT_PUBLIC_SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !MUX_TOKEN_ID ||
  !MUX_TOKEN_SECRET
) {
  console.error(
    'Missing env vars. Run with: npx tsx --env-file=.env.local scripts/backfill-mux-ids.ts',
  );
  process.exit(1);
}

const mux = new Mux({ tokenId: MUX_TOKEN_ID, tokenSecret: MUX_TOKEN_SECRET });
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function muxThumbnailUrl(playbackId: string, width = 640): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=${width}`;
}

const FULL_SONG_THRESHOLD_SEC = 150;

interface Stats {
  assetsScanned: number;
  assetsReady: number;
  assetsErrored: number;
  noUploadId: number;
  noMatchingRow: number;
  alreadyComplete: number;
  rowsUpdated: number;
  rowsRemoved: number;
}

async function main() {
  const stats: Stats = {
    assetsScanned: 0,
    assetsReady: 0,
    assetsErrored: 0,
    noUploadId: 0,
    noMatchingRow: 0,
    alreadyComplete: 0,
    rowsUpdated: 0,
    rowsRemoved: 0,
  };

  console.log('Listing Mux video assets…\n');

  // The SDK paginates automatically when iterated with for-await.
  for await (const asset of mux.video.assets.list({ limit: 100 })) {
    stats.assetsScanned++;
    const shortId = asset.id.slice(0, 8);

    const uploadId = (asset as { upload_id?: string }).upload_id;
    if (!uploadId) {
      stats.noUploadId++;
      console.log(`- ${shortId}: skipped (no upload_id)`);
      continue;
    }

    // Errored asset → mark the row removed if we have one.
    if (asset.status === 'errored') {
      stats.assetsErrored++;
      const { data: removed, error } = await supabase
        .from('media')
        .update({ status: 'removed' })
        .eq('mux_upload_id', uploadId)
        .neq('status', 'removed')
        .select('id');
      if (error) {
        console.error(`- ${shortId} (errored): update failed — ${error.message}`);
      } else {
        const n = removed?.length ?? 0;
        stats.rowsRemoved += n;
        console.log(`- ${shortId} (errored): marked ${n} row(s) removed`);
      }
      continue;
    }

    if (asset.status !== 'ready') {
      console.log(`- ${shortId}: not ready yet (${asset.status})`);
      continue;
    }

    stats.assetsReady++;

    const playbackId = asset.playback_ids?.[0]?.id;
    if (!playbackId) {
      console.log(`- ${shortId}: ready, but no playback id on the asset`);
      continue;
    }

    const duration = asset.duration;
    const isFullSong =
      typeof duration === 'number' && duration >= FULL_SONG_THRESHOLD_SEC;

    // Pre-check: do we have a matching row that still needs filling?
    const { data: candidates, error: lookupErr } = await supabase
      .from('media')
      .select('id, mux_playback_id')
      .eq('mux_upload_id', uploadId);
    if (lookupErr) {
      console.error(`- ${shortId}: lookup failed — ${lookupErr.message}`);
      continue;
    }
    if (!candidates || candidates.length === 0) {
      stats.noMatchingRow++;
      console.log(`- ${shortId}: no media row matches upload ${uploadId.slice(0, 8)}…`);
      continue;
    }
    const needsUpdate = candidates.filter((r) => r.mux_playback_id == null);
    if (needsUpdate.length === 0) {
      stats.alreadyComplete++;
      console.log(`- ${shortId}: row already filled in (${candidates[0].id.slice(0, 8)}…)`);
      continue;
    }

    // Apply the same patch the webhook would have applied. Filter on
    // `mux_playback_id is null` so we don't clobber rows updated since the
    // lookup above (concurrency-safe).
    const { data: updated, error } = await supabase
      .from('media')
      .update({
        mux_asset_id: asset.id,
        mux_playback_id: playbackId,
        thumbnail_url: muxThumbnailUrl(playbackId),
        duration_sec: duration != null ? Math.round(duration) : null,
        storage_url: `https://stream.mux.com/${playbackId}.m3u8`,
        is_full_song: isFullSong,
        status: 'active',
      })
      .eq('mux_upload_id', uploadId)
      .is('mux_playback_id', null)
      .select('id');

    if (error) {
      console.error(`- ${shortId}: update failed — ${error.message}`);
      continue;
    }

    const n = updated?.length ?? 0;
    stats.rowsUpdated += n;
    const durTxt = duration != null ? `${duration.toFixed(1)}s` : '?';
    console.log(
      `✓ ${shortId}: updated ${n} row(s) · duration ${durTxt} · fullSong=${isFullSong}`,
    );
  }

  console.log('\n── Summary ──────────────────────────────');
  console.log(`Assets scanned:          ${stats.assetsScanned}`);
  console.log(`Assets ready:            ${stats.assetsReady}`);
  console.log(`Assets errored:          ${stats.assetsErrored}`);
  console.log(`Assets missing upload_id: ${stats.noUploadId}`);
  console.log(`Assets with no match:    ${stats.noMatchingRow}`);
  console.log(`Already complete:        ${stats.alreadyComplete}`);
  console.log(`Rows updated:            ${stats.rowsUpdated}`);
  console.log(`Rows marked removed:     ${stats.rowsRemoved}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
