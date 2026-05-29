-- 0010_page_claims.sql
-- Artist / entity page claim requests.

-- Add claimed columns to entities
ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS claimed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_by TEXT;

-- Page claim requests table
CREATE TABLE IF NOT EXISTS page_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('artist', 'manager', 'label', 'publicist', 'other')),
  social_handle TEXT,
  entity_type TEXT NOT NULL DEFAULT 'music' CHECK (entity_type IN ('music', 'sports', 'event_brand', 'venue')),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE page_claims ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a claim (public form)
CREATE POLICY "Anyone can submit a claim"
  ON page_claims FOR INSERT
  WITH CHECK (true);

-- Only service role can read/update (admin only)
CREATE POLICY "Service role full access to claims"
  ON page_claims FOR ALL
  TO service_role
  USING (true);

-- Grants
GRANT INSERT ON public.page_claims TO anon, authenticated;
GRANT ALL ON public.page_claims TO service_role;
