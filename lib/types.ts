// Hand-rolled DB row types — mirror the schema in supabase/migrations/0001_init.sql.
// Replace later with `supabase gen types typescript` output once the project is linked.

export type EntityType = 'artist' | 'team' | 'event_brand' | 'venue';

export interface Entity {
  id: string;
  slug: string;
  name: string;
  type: EntityType;
  genre: string | null;
  bio: string | null;
  verified: boolean;
  claimed: boolean;
  hero_image_url: string | null;
  follower_count: number;
  created_at: string;
}

export interface EventRow {
  id: string;
  entity_id: string;
  slug: string;
  name: string;
  venue_name: string;
  city: string;
  state: string | null;
  country: string;
  event_date: string; // ISO date 'YYYY-MM-DD'
  tour_name: string | null;
  setlist: string[] | null;
  external_id: string | null;
  upload_count: number;
  photo_count: number;
  video_count: number;
  created_at: string;
}

export type SectionTag =
  | 'floor'
  | 'section_100'
  | 'section_200'
  | 'upper'
  | 'stage_left'
  | 'stage_right'
  // Phase 5 upload-flow additions (matches the migration 0006 CHECK constraint).
  | 'pit'
  | 'seated'
  | 'vip'
  | 'outside'
  | 'concourse';

export type MediaFileType = 'photo' | 'video';
export type MediaStatus = 'uploading' | 'active' | 'pending_review' | 'removed';

export interface Media {
  id: string;
  event_id: string;
  entity_id: string;
  uploader_id: string | null;
  upload_session: string | null;
  file_type: MediaFileType;
  storage_url: string;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  song_tag: string | null;
  section_tag: SectionTag | null;
  caption: string | null;
  like_count: number;
  view_count: number;
  is_full_song: boolean;
  status: MediaStatus;
  created_at: string;
}

export interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  upload_count: number;
  show_count: number;
  bio: string | null;
  created_at: string;
}

export interface Like {
  id: string;
  media_id: string;
  user_id: string | null;
  session_token: string | null;
  created_at: string;
}

export interface Follow {
  id: string;
  user_id: string;
  entity_id: string;
  created_at: string;
}

// UI-facing labels for section_tag values.
export const SECTION_LABELS: Record<SectionTag, string> = {
  floor: 'Floor / Pit',
  section_100: 'Lower Bowl',
  section_200: 'Section 200s',
  upper: 'Upper Deck',
  stage_left: 'Stage left',
  stage_right: 'Stage right',
  pit: 'Pit',
  seated: 'Seated',
  vip: 'VIP',
  outside: 'Outside',
  concourse: 'Concourse',
};

// Pre-cased labels for the yellow section badge shown on media thumbnails.
// These are rendered WITHOUT a CSS `uppercase` transform so the trailing "s"
// in "100s"/"200s" stays lowercase — apply them as-is, do not add `uppercase`.
export const SECTION_BADGE_LABELS: Record<SectionTag, string> = {
  floor: 'FLOOR / PIT',
  section_100: 'LOWER BOWL',
  section_200: 'SECTION 200s',
  upper: 'UPPER DECK',
  stage_left: 'STAGE LEFT',
  stage_right: 'STAGE RIGHT',
  pit: 'PIT',
  seated: 'SEATED',
  vip: 'VIP',
  outside: 'OUTSIDE',
  concourse: 'CONCOURSE',
};

// All section values the API will accept (used to validate /api/upload/complete).
export const SECTION_ORDER: SectionTag[] = [
  'floor',
  'section_100',
  'section_200',
  'upper',
  'stage_left',
  'stage_right',
  'pit',
  'seated',
  'vip',
  'outside',
  'concourse',
];

// The shortlist shown in the Phase-5 upload-flow tagging step. We keep this
// curated separately so the older detail-rich values (stage_left, section_100,
// etc.) don't clutter the mobile tag step.
export const UPLOAD_SECTION_OPTIONS: SectionTag[] = [
  'floor',
  'section_100',
  'upper',
  'vip',
];

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  artist: 'Artist',
  team: 'Team',
  event_brand: 'Event',
  venue: 'Venue',
};
