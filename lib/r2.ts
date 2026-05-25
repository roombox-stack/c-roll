// Cloudflare R2 client (S3-compatible). SERVER-ONLY.
// Used for photo uploads. Videos go to Mux instead.
import 'server-only';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let cached: S3Client | null = null;

function client(): S3Client {
  if (cached) return cached;
  cached = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return cached;
}

/** Allowed photo MIME types. Enforced server-side before issuing a presigned URL. */
export const ALLOWED_PHOTO_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export const MAX_PHOTO_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Build the canonical R2 object key for a photo upload.
 * Format: `media/<eventId>/<mediaId>-<sanitized-filename>`
 */
export function photoKey(eventId: string, mediaId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  return `media/${eventId}/${mediaId}-${safe}`;
}

export async function createPhotoUploadUrl(opts: {
  key: string;
  contentType: string;
}): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: opts.key,
    ContentType: opts.contentType,
  });
  return getSignedUrl(client(), cmd, { expiresIn: 300 });
}

export function publicUrlForKey(key: string): string {
  const base = process.env.R2_PUBLIC_URL!.replace(/\/$/, '');
  return `${base}/${key}`;
}
