-- ============================================================
-- MilkBridge Schema Enhancement v2
-- ============================================================
-- Run after schema.sql to add production-grade MilkBridge tables
-- ============================================================

-- ── Enhance milk_donors table ───────────────────────────────────────────────────
-- Add new columns for comprehensive donor registration

ALTER TABLE milk_donors
ADD COLUMN IF NOT EXISTS pincode text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS screening_status text DEFAULT 'pending',  -- 'pending' | 'cleared' | 'rejected'
ADD COLUMN IF NOT EXISTS screening_date date,
ADD COLUMN IF NOT EXISTS availability_start time DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS availability_end time DEFAULT '20:00',
ADD COLUMN IF NOT EXISTS is_anonymous boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS lat float,
ADD COLUMN IF NOT EXISTS lng float,
ADD COLUMN IF NOT EXISTS mobile text,
ADD COLUMN IF NOT EXISTS last_donation_date date;

-- ── Enhance milk_requests table ─────────────────────────────────────────────────
-- Add urgency, volume, and location fields matching BloodBridge pattern

ALTER TABLE milk_requests
ADD COLUMN IF NOT EXISTS urgency text DEFAULT 'normal',  -- 'critical' | 'urgent' | 'normal'
ADD COLUMN IF NOT EXISTS pincode text,
ADD COLUMN IF NOT EXISTS volume_needed_ml integer,
ADD COLUMN IF NOT EXISTS lat float,
ADD COLUMN IF NOT EXISTS lng float,
ADD COLUMN IF NOT EXISTS matched_at timestamptz,
ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz;

-- ── Create milk_donations table (Milk Passport tracking) ────────────────────────
-- Tracks each individual donation with full provenance

CREATE TABLE IF NOT EXISTS milk_donations (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  passport_id          text UNIQUE NOT NULL,  -- Human-readable: "MP-2024-001234"
  donor_id             uuid REFERENCES donors(id) ON DELETE SET NULL,
  milk_donor_id        uuid REFERENCES milk_donors(id) ON DELETE SET NULL,
  request_id           uuid REFERENCES milk_requests(id) ON DELETE SET NULL,

  -- Collection info
  collection_date      date NOT NULL,
  collection_time      time,
  volume_ml            integer NOT NULL,

  -- Processing info
  pasteurized          boolean DEFAULT false,
  pasteurization_date  date,
  pasteurization_method text,  -- 'holder' | 'htst' | 'uv'
  expiry_date          date,

  -- Receiving info
  receiving_hospital_id uuid REFERENCES hospitals(id) ON DELETE SET NULL,
  receiving_infant_ref  text,  -- Anonymized: "Baby of Ward 3" or "Infant #42"
  delivered_date       date,

  -- Status tracking
  status               text DEFAULT 'collected',  -- 'collected' | 'processing' | 'pasteurized' | 'in_transit' | 'delivered' | 'expired' | 'rejected'
  quality_check_passed boolean,
  rejection_reason     text,

  -- Metadata
  notes                text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- ── Create milk_matches table ───────────────────────────────────────────────────
-- Track donor-request matches (like BloodBridge matches)

CREATE TABLE IF NOT EXISTS milk_matches (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id   uuid REFERENCES milk_requests(id) ON DELETE CASCADE,
  donor_id     uuid REFERENCES donors(id) ON DELETE SET NULL,
  milk_donor_id uuid REFERENCES milk_donors(id) ON DELETE SET NULL,

  match_score  float,              -- Proximity + availability score
  distance_km  float,

  status       text DEFAULT 'pending',  -- 'pending' | 'notified' | 'accepted' | 'declined' | 'fulfilled' | 'expired'
  notified_at  timestamptz,
  responded_at timestamptz,

  created_at   timestamptz DEFAULT now()
);

-- ── Enable RLS on new tables ────────────────────────────────────────────────────

ALTER TABLE milk_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE milk_matches ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ────────────────────────────────────────────────────────────────
-- Backend uses service role key (bypasses RLS). These are for direct frontend access.

-- Milk donations: public read for verified hospitals, donors can see their own
CREATE POLICY "Public read milk_donations" ON milk_donations FOR SELECT USING (true);

-- Milk matches: public read
CREATE POLICY "Public read milk_matches" ON milk_matches FOR SELECT USING (true);

-- ── Enable Realtime ─────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE milk_donations;
ALTER PUBLICATION supabase_realtime ADD TABLE milk_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE milk_requests;

-- ── Indexes for performance ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_milk_donors_pincode ON milk_donors(pincode);
CREATE INDEX IF NOT EXISTS idx_milk_donors_screening ON milk_donors(screening_status);
CREATE INDEX IF NOT EXISTS idx_milk_donors_available ON milk_donors(is_available);

CREATE INDEX IF NOT EXISTS idx_milk_requests_status ON milk_requests(status);
CREATE INDEX IF NOT EXISTS idx_milk_requests_urgency ON milk_requests(urgency);
CREATE INDEX IF NOT EXISTS idx_milk_requests_hospital ON milk_requests(hospital_id);

CREATE INDEX IF NOT EXISTS idx_milk_donations_donor ON milk_donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_milk_donations_hospital ON milk_donations(receiving_hospital_id);
CREATE INDEX IF NOT EXISTS idx_milk_donations_status ON milk_donations(status);
CREATE INDEX IF NOT EXISTS idx_milk_donations_passport ON milk_donations(passport_id);

CREATE INDEX IF NOT EXISTS idx_milk_matches_request ON milk_matches(request_id);
CREATE INDEX IF NOT EXISTS idx_milk_matches_donor ON milk_matches(donor_id);
CREATE INDEX IF NOT EXISTS idx_milk_matches_status ON milk_matches(status);

-- ── Function to generate passport IDs ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_milk_passport_id()
RETURNS text AS $$
DECLARE
  yr text;
  seq int;
  new_id text;
BEGIN
  yr := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(passport_id FROM 9) AS integer)), 0) + 1
  INTO seq
  FROM milk_donations
  WHERE passport_id LIKE 'MP-' || yr || '-%';

  new_id := 'MP-' || yr || '-' || LPAD(seq::text, 6, '0');
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- ── Sample data for testing ─────────────────────────────────────────────────────

-- Update existing milk_donors with new fields
UPDATE milk_donors SET
  screening_status = 'cleared',
  screening_date = CURRENT_DATE - INTERVAL '30 days',
  pincode = '400001',
  city = 'Mumbai'
WHERE id IN (SELECT id FROM milk_donors LIMIT 3);

-- Add a sample milk request with urgency
INSERT INTO milk_requests (hospital_id, infant_name, daily_quantity_ml, status, urgency, pincode)
SELECT id, 'NICU Ward A', 300, 'open', 'urgent', '400001'
FROM hospitals WHERE reg_number = 'KE001' LIMIT 1
ON CONFLICT DO NOTHING;
