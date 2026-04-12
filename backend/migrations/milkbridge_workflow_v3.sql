-- MilkBridge Workflow Enhancement Migration v3
-- Run this in Supabase SQL Editor

-- Add pickup scheduling fields to milk_matches
ALTER TABLE milk_matches ADD COLUMN IF NOT EXISTS pickup_date DATE;
ALTER TABLE milk_matches ADD COLUMN IF NOT EXISTS pickup_time TEXT;
ALTER TABLE milk_matches ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
ALTER TABLE milk_matches ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

-- Add cold-chain status tracking to milk_donations
ALTER TABLE milk_donations ADD COLUMN IF NOT EXISTS cold_chain_status TEXT DEFAULT 'collected';
ALTER TABLE milk_donations ADD COLUMN IF NOT EXISTS temperature_log JSONB DEFAULT '[]';
ALTER TABLE milk_donations ADD COLUMN IF NOT EXISTS quality_check_passed BOOLEAN;
ALTER TABLE milk_donations ADD COLUMN IF NOT EXISTS quality_check_date DATE;

-- Update milk_bank for better cold-chain tracking
ALTER TABLE milk_bank ADD COLUMN IF NOT EXISTS cold_chain_status TEXT DEFAULT 'Available';
ALTER TABLE milk_bank ADD COLUMN IF NOT EXISTS temperature_log JSONB DEFAULT '[]';

-- Add index for faster donor matches lookup
CREATE INDEX IF NOT EXISTS idx_milk_matches_donor_id ON milk_matches(donor_id);
CREATE INDEX IF NOT EXISTS idx_milk_matches_request_id ON milk_matches(request_id);
CREATE INDEX IF NOT EXISTS idx_milk_matches_status ON milk_matches(status);

-- Add index for faster donation lookups
CREATE INDEX IF NOT EXISTS idx_milk_donations_passport ON milk_donations(passport_id);
CREATE INDEX IF NOT EXISTS idx_milk_donations_status ON milk_donations(status);

-- Grant permissions (adjust if needed for your RLS setup)
-- These ensure the API can access the new columns
COMMENT ON COLUMN milk_matches.pickup_date IS 'Scheduled pickup date for the donation';
COMMENT ON COLUMN milk_matches.pickup_time IS 'Scheduled pickup time for the donation';
COMMENT ON COLUMN milk_donations.cold_chain_status IS 'Current cold-chain status: collected, pasteurized, in_transit, delivered, expired';
