// Mux Node SDK wrapper. SERVER-ONLY.
import 'server-only';
import Mux from '@mux/mux-node';

let cached: Mux | null = null;

export function getMux(): Mux {
  if (cached) return cached;
  cached = new Mux({
    tokenId: process.env.MUX_TOKEN_ID!,
    tokenSecret: process.env.MUX_TOKEN_SECRET!,
  });
  return cached;
}

export const MUX_WEBHOOK_SECRET = process.env.MUX_WEBHOOK_SECRET!;

/**
 * Create a Mux direct upload. Returns the upload URL the browser PUTs to
 * and the Mux upload ID. The upload ID lets us correlate the eventual
 * `video.asset.ready` webhook with our media row.
 */
export async function createDirectUpload() {
  const mux = getMux();
  const upload = await mux.video.uploads.create({
    cors_origin: process.env.NEXT_PUBLIC_APP_URL!,
    new_asset_settings: {
      playback_policy: ['public'],
      // `mp4_support: 'standard'` would let us download an MP4. Skipping for V1.
    },
  });
  return {
    uploadId: upload.id,
    uploadUrl: upload.url,
  };
}

export function muxThumbnailUrl(playbackId: string, opts?: { time?: number; width?: number }) {
  const params = new URLSearchParams();
  if (opts?.time != null) params.set('time', String(opts.time));
  if (opts?.width != null) params.set('width', String(opts.width));
  const qs = params.toString();
  return `https://image.mux.com/${playbackId}/thumbnail.jpg${qs ? `?${qs}` : ''}`;
}
