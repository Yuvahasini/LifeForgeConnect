-- ============================================================
-- LifeForge Connect — Supabase Schema v3
-- ============================================================
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run All
-- ============================================================

-- ── Core Tables ───────────────────────────────────────────────────────────────

create table if not exists donors (
  id                   uuid default gen_random_uuid() primary key,
  name                 text not null,
  mobile               text unique,
  aadhaar              text,
  dob                  date,
  gender               text,
  city                 text,
  pincode              text,
  blood_group          text,
  donor_types          text[] default '{}',   -- ['blood','platelet','marrow','organ','milk']
  hla_type             text[] default '{}',   -- ['A*02:01','B*07:02','C*07:01','DRB1*15:01']
  is_available         boolean default true,
  last_donation_date   date,
  trust_score          integer default 50,
  is_verified          boolean default false,
  lat                  float,
  lng                  float,
  created_at           timestamptz default now()
);

create table if not exists hospitals (
  id           uuid default gen_random_uuid() primary key,
  name         text not null,
  reg_number   text unique,
  license      text,
  address      text,
  city         text,
  contact      text,
  is_verified  boolean default false,
  lat          float,
  lng          float,
  created_at   timestamptz default now()
);

create table if not exists otp_store (
  mobile     text primary key,
  otp        text not null,
  created_at timestamptz default now()
);

-- ── BloodBridge ───────────────────────────────────────────────────────────────

create table if not exists blood_requests (
  id           uuid default gen_random_uuid() primary key,
  hospital_id  uuid references hospitals(id) on delete set null,
  blood_group  text not null,
  units        integer default 1,
  urgency      text default 'urgent',   -- 'critical' | 'urgent' | 'normal'
  status       text default 'open',     -- 'open' | 'fulfilled' | 'closed'
  lat          float,
  lng          float,
  created_at   timestamptz default now()
);

-- ── ThalCare ─────────────────────────────────────────────────────────────────

create table if not exists thal_patients (
  id                           uuid default gen_random_uuid() primary key,
  name                         text not null,
  blood_group                  text,
  dob                          date,
  transfusion_frequency_days   integer default 21,
  hospital_id                  uuid references hospitals(id) on delete set null,
  last_transfusion_date        date,
  next_transfusion_date        date,
  created_at                   timestamptz default now()
);

-- ── PlateletAlert ─────────────────────────────────────────────────────────────

create table if not exists platelet_requests (
  id            uuid default gen_random_uuid() primary key,
  patient_name  text,
  cancer_type   text,
  blood_group   text,
  units         integer default 1,
  hospital_id   uuid references hospitals(id) on delete set null,
  urgency       text default 'urgent',
  status        text default 'open',
  created_at    timestamptz default now()
);

-- ── LastGift (Organs) ─────────────────────────────────────────────────────────

create table if not exists organ_pledges (
  id               uuid default gen_random_uuid() primary key,
  donor_id         uuid references donors(id) on delete cascade,
  organs           text[] default '{}',
  family_consent   boolean default false,
  pledge_card_url  text,
  is_active        boolean default true,
  created_at       timestamptz default now()
);

create table if not exists organ_requests (
  id               uuid default gen_random_uuid() primary key,
  hospital_id      uuid references hospitals(id) on delete set null,
  recipient_name   text,
  organ_needed     text not null,
  urgency_score    integer default 5,
  blood_group      text,
  wait_label       text,   -- e.g. "3.2 yrs"
  status           text default 'waiting',   -- 'waiting' | 'matched' | 'transplanted'
  lat              float,
  lng              float,
  created_at       timestamptz default now()
);

-- ── MilkBridge ────────────────────────────────────────────────────────────────

create table if not exists milk_donors (
  id                    uuid default gen_random_uuid() primary key,
  donor_id              uuid references donors(id) on delete cascade,
  baby_age_months       integer,
  quantity_ml_per_day   integer,
  health_score          integer default 70,
  test_doc_url          text,
  is_available          boolean default true,
  created_at            timestamptz default now()
);

create table if not exists milk_requests (
  id                 uuid default gen_random_uuid() primary key,
  hospital_id        uuid references hospitals(id) on delete set null,
  infant_name        text,
  daily_quantity_ml  integer,
  status             text default 'open',
  created_at         timestamptz default now()
);

create table if not exists milk_bank (
  id               uuid default gen_random_uuid() primary key,
  passport_id      text unique not null,
  donor_id         uuid references donors(id) on delete set null,
  quantity_liters  float,
  pasteurized_date date,
  expiry_date      date,
  status           text default 'Available',   -- 'Available' | 'Reserved' | 'Low Stock' | 'Expired'
  created_at       timestamptz default now()
);

-- ── Notifications ─────────────────────────────────────────────────────────────

create table if not exists notifications (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null,               -- donor or hospital ID
  title       text not null,
  message     text,
  type        text default 'info',         -- 'info' | 'alert' | 'success' | 'warning'
  module      text,                        -- 'blood' | 'platelet' | 'marrow' | 'organ' | 'milk' | 'thal'
  is_read     boolean default false,
  created_at  timestamptz default now()
);

-- ── Matches (central log for all 6 modules) ───────────────────────────────────

create table if not exists matches (
  id          uuid default gen_random_uuid() primary key,
  module      text not null,   -- 'blood' | 'platelet' | 'marrow' | 'organ' | 'milk' | 'thal'
  donor_id    uuid references donors(id) on delete set null,
  request_id  uuid,            -- generic — points to relevant module's request table
  match_score float,
  status      text default 'pending',   -- 'pending' | 'accepted' | 'fulfilled' | 'rejected'
  created_at  timestamptz default now()
);

-- ── Enable Realtime for live-updating pages ───────────────────────────────────

alter publication supabase_realtime add table blood_requests;
alter publication supabase_realtime add table platelet_requests;
alter publication supabase_realtime add table organ_requests;
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table notifications;

-- ── Row Level Security ─────────────────────────────────────────────────────────
-- Backend uses SERVICE ROLE KEY → bypasses RLS completely.
-- These policies only apply to frontend if you ever use the anon key directly.

alter table donors           enable row level security;
alter table hospitals        enable row level security;
alter table blood_requests   enable row level security;
alter table platelet_requests enable row level security;
alter table organ_requests   enable row level security;
alter table organ_pledges    enable row level security;
alter table thal_patients    enable row level security;
alter table milk_donors      enable row level security;
alter table milk_requests    enable row level security;
alter table milk_bank        enable row level security;
alter table matches          enable row level security;

-- Public read (anyone can read donor lists, requests, hospitals)
create policy "Public read donors"          on donors           for select using (true);
create policy "Public read hospitals"       on hospitals        for select using (true);
create policy "Public read blood_requests"  on blood_requests   for select using (true);
create policy "Public read platelet_req"    on platelet_requests for select using (true);
create policy "Public read organ_requests"  on organ_requests   for select using (true);
create policy "Public read thal_patients"   on thal_patients    for select using (true);
create policy "Public read milk_donors"     on milk_donors      for select using (true);
create policy "Public read milk_requests"   on milk_requests    for select using (true);
create policy "Public read milk_bank"       on milk_bank        for select using (true);

-- ── Seed Data ─────────────────────────────────────────────────────────────────

insert into hospitals (name, reg_number, address, city, contact, is_verified, lat, lng) values
  ('Apollo Hospitals',       'AP001', '21 Greams Lane, Chennai',         'Chennai',   '9876543210', true,  13.0604, 80.2496),
  ('AIIMS Delhi',            'AI001', 'Sri Aurobindo Marg, New Delhi',   'New Delhi', '9876543211', true,  28.5672, 77.2100),
  ('KEM Hospital',           'KE001', 'Acharya Donde Marg, Mumbai',      'Mumbai',    '9876543213', true,  19.0021, 72.8424),
  ('Tata Memorial',          'TM001', 'Dr E Borges Road, Parel, Mumbai', 'Mumbai',    '9876543214', true,  19.0044, 72.8421),
  ('CMC Vellore',            'CM001', 'Ida Scudder Road, Vellore',       'Vellore',   '9876543215', true,  12.9249, 79.1325),
  ('Fortis Hospital Delhi',  'FO001', 'Sector 62, Noida',                'Delhi',     '9876543216', true,  28.6200, 77.3600),
  ('Manipal Hospital',       'MH001', 'HAL Airport Road, Bengaluru',     'Bengaluru', '9876543212', true,  12.9716, 77.5946)
on conflict (reg_number) do nothing;

insert into donors (name, mobile, blood_group, city, donor_types, trust_score, is_available, is_verified, lat, lng) values
  ('Arjun Sharma',   '9000000001', 'O+',  'Mumbai',    ARRAY['blood','platelet'],       85, true,  true,  19.0760, 72.8777),
  ('Priya Rajan',    '9000000002', 'A+',  'Chennai',   ARRAY['blood','organ'],           78, true,  true,  13.0569, 80.2425),
  ('Kiran Mehta',    '9000000003', 'B+',  'New Delhi', ARRAY['blood'],                   72, true,  false, 28.6315, 77.2167),
  ('Sana Sheikh',    '9000000004', 'AB+', 'Bengaluru', ARRAY['blood','marrow'],          91, true,  true,  12.9352, 77.6245),
  ('Ravi Kumar',     '9000000005', 'O-',  'Mumbai',    ARRAY['blood','platelet'],        88, true,  true,  19.0100, 72.8400),
  ('Deepa Nair',     '9000000006', 'A-',  'Bengaluru', ARRAY['milk'],                   80, true,  true,  12.9900, 77.5700),
  ('Amit Patel',     '9000000007', 'B-',  'New Delhi', ARRAY['blood','organ'],           65, true,  false, 28.5500, 77.2500),
  ('Meena Pillai',   '9000000008', 'O+',  'Chennai',   ARRAY['blood','marrow'],          77, true,  true,  13.0700, 80.2600),
  ('Deepak A.',      '9000000009', 'A+',  'Mumbai',    ARRAY['blood','platelet'],        92, true,  true,  19.0220, 72.8560),
  ('Rekha B.',       '9000000010', 'O+',  'Mumbai',    ARRAY['blood','platelet'],        87, true,  true,  19.0450, 72.8205),
  ('Nisha Patel',    '9000000011', 'B+',  'Mumbai',    ARRAY['milk'],                   83, true,  true,  19.1136, 72.8697),
  ('Priyanka Roy',   '9000000012', 'A+',  'Kolkata',   ARRAY['milk'],                   79, true,  true,  22.5726, 88.3639),
  ('Kavya S.',       '9000000013', 'O+',  'Bengaluru', ARRAY['milk'],                   85, true,  true,  12.9352, 77.6245)
on conflict (mobile) do nothing;

-- HLA types for marrow donors
update donors set hla_type = ARRAY['A*02:01','B*07:02','C*07:01','DRB1*15:01'] where mobile = '9000000004';
update donors set hla_type = ARRAY['A*02:01','B*08:01','C*07:01','DRB1*03:01'] where mobile = '9000000008';
update donors set hla_type = ARRAY['A*03:01','B*07:02','C*07:02','DRB1*15:01'] where mobile = '9000000002';

-- Milk donors
insert into milk_donors (donor_id, baby_age_months, quantity_ml_per_day, health_score, is_available)
  select id, 3, 200, 85, true from donors where mobile = '9000000011'
on conflict do nothing;
insert into milk_donors (donor_id, baby_age_months, quantity_ml_per_day, health_score, is_available)
  select id, 2, 150, 79, true from donors where mobile = '9000000012'
on conflict do nothing;
insert into milk_donors (donor_id, baby_age_months, quantity_ml_per_day, health_score, is_available)
  select id, 4, 180, 85, true from donors where mobile = '9000000013'
on conflict do nothing;

-- Milk bank entries (Milk Passport table)
insert into milk_bank (passport_id, donor_id, quantity_liters, pasteurized_date, expiry_date, status)
  select 'MB-001', id, 1.2, current_date - 1, current_date + 6, 'Available'
  from donors where mobile = '9000000011'
on conflict (passport_id) do nothing;
insert into milk_bank (passport_id, donor_id, quantity_liters, pasteurized_date, expiry_date, status)
  select 'MB-002', id, 0.8, current_date - 2, current_date + 5, 'Reserved'
  from donors where mobile = '9000000012'
on conflict (passport_id) do nothing;
insert into milk_bank (passport_id, donor_id, quantity_liters, pasteurized_date, expiry_date, status)
  select 'MB-003', id, 1.5, current_date - 3, current_date + 4, 'Available'
  from donors where mobile = '9000000013'
on conflict (passport_id) do nothing;

-- Thal patients
insert into thal_patients (name, blood_group, hospital_id, transfusion_frequency_days, last_transfusion_date, next_transfusion_date)
  select 'Aarav Singh', 'B+', id, 21, current_date - 18, current_date + 3
  from hospitals where reg_number = 'AI001' limit 1
on conflict do nothing;
insert into thal_patients (name, blood_group, hospital_id, transfusion_frequency_days, last_transfusion_date, next_transfusion_date)
  select 'Meera Iyer', 'O+', id, 28, current_date - 22, current_date + 6
  from hospitals where reg_number = 'CM001' limit 1
on conflict do nothing;
insert into thal_patients (name, blood_group, hospital_id, transfusion_frequency_days, last_transfusion_date, next_transfusion_date)
  select 'Rohan Das', 'A+', id, 14, current_date - 13, current_date + 1
  from hospitals where reg_number = 'KE001' limit 1
on conflict do nothing;

-- Blood requests (open + critical for dashboard urgent section)
insert into blood_requests (hospital_id, blood_group, units, urgency, status, lat, lng)
  select id, 'O-', 3, 'critical', 'open', 19.0021, 72.8424
  from hospitals where reg_number = 'KE001' limit 1
on conflict do nothing;
insert into blood_requests (hospital_id, blood_group, units, urgency, status, lat, lng)
  select id, 'AB+', 2, 'urgent', 'open', 19.0044, 72.8421
  from hospitals where reg_number = 'TM001' limit 1
on conflict do nothing;
insert into blood_requests (hospital_id, blood_group, units, urgency, status, lat, lng)
  select id, 'B-', 1, 'urgent', 'open', 13.0604, 80.2496
  from hospitals where reg_number = 'AP001' limit 1
on conflict do nothing;

-- Platelet requests (matching frontend mock data)
insert into platelet_requests (patient_name, cancer_type, blood_group, units, hospital_id, urgency, status)
  select 'Ananya R.', 'Leukemia (AML)', 'A+', 2, id, 'urgent', 'open'
  from hospitals where reg_number = 'TM001' limit 1
on conflict do nothing;
insert into platelet_requests (patient_name, cancer_type, blood_group, units, hospital_id, urgency, status)
  select 'Suresh M.', 'Lymphoma', 'O+', 1, id, 'critical', 'open'
  from hospitals where reg_number = 'AI001' limit 1
on conflict do nothing;

-- Organ requests (matching frontend recipients mock data)
insert into organ_requests (hospital_id, recipient_name, organ_needed, blood_group, urgency_score, wait_label, status, lat, lng)
  select id, 'P. Ramaswamy', 'Kidney', 'O+', 9, '3.2 yrs', 'waiting', 30.7333, 76.7794
  from hospitals where reg_number = 'AI001' limit 1
on conflict do nothing;
insert into organ_requests (hospital_id, recipient_name, organ_needed, blood_group, urgency_score, wait_label, status, lat, lng)
  select id, 'S. Krishnan', 'Liver', 'B+', 9, '1.8 yrs', 'waiting', 13.0604, 80.2496
  from hospitals where reg_number = 'AP001' limit 1
on conflict do nothing;
insert into organ_requests (hospital_id, recipient_name, organ_needed, blood_group, urgency_score, wait_label, status, lat, lng)
  select id, 'Anita G.', 'Heart', 'A-', 10, '11 months', 'waiting', 28.5672, 77.2100
  from hospitals where reg_number = 'FO001' limit 1
on conflict do nothing;

-- Milk shortage request
insert into milk_requests (hospital_id, infant_name, daily_quantity_ml, status)
  select id, 'Premature Infants Ward', 500, 'open'
  from hospitals where reg_number = 'AP001' limit 1
on conflict do nothing;