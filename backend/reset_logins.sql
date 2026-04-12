-- Run this entire script in Supabase Dashboard → SQL Editor
-- This will wipe all current users, profiles, and their dependent records,
-- and then insert a few fresh logins using pg-crypto.

-- 1. DELETE dependent records to avoid orphan conflicts
DELETE FROM public.organ_pledges;
DELETE FROM public.organ_requests;
DELETE FROM public.platelet_requests;
DELETE FROM public.blood_requests;
DELETE FROM public.thal_patients;
DELETE FROM public.milk_requests;
DELETE FROM public.milk_donors;
DELETE FROM public.milk_bank;
DELETE FROM public.matches;
DELETE FROM public.notifications;

-- 2. DELETE profiles and logins
DELETE FROM public.donors;
DELETE FROM public.hospitals;
DELETE FROM auth.users;

-- 3. INSERT fresh logins and profiles
DO $$ 
DECLARE
  new_donor_id uuid := gen_random_uuid();
  new_hospital_id uuid := gen_random_uuid();
BEGIN

  -- A. Add a test Donor (Email: donor@test.com | Password: password123)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
  )
  VALUES (
    new_donor_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'donor@test.com',
    crypt('password123', gen_salt('bf')),
    now(), now(), now()
  );

  INSERT INTO public.donors (
    id, name, mobile, city, blood_group, donor_types, is_verified, lat, lng, trust_score
  )
  VALUES (
    new_donor_id, 'Arjun (Test Donor)', '9000000001', 'Mumbai', 'O+', ARRAY['blood','platelet','milk'], true, 19.0760, 72.8777, 95
  );

  -- B. Add a test Hospital (Email: hospital@test.com | Password: password123)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
  )
  VALUES (
    new_hospital_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'hospital@test.com',
    crypt('password123', gen_salt('bf')),
    now(), now(), now()
  );

  INSERT INTO public.hospitals (
    id, name, reg_number, address, city, contact, is_verified, lat, lng
  )
  VALUES (
    new_hospital_id, 'Apollo Test Hospital', 'TEST-H-001', 'Main Road', 'Mumbai', '8000000001', true, 19.0044, 72.8421
  );

END $$;
