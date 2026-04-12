-- Run this in Supabase SQL Editor to wipe the manual entries
DELETE FROM auth.users WHERE email IN ('donor@test.com', 'hospital@test.com');
