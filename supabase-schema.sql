-- ====================================================================
-- Al-Ahsa Smart Transit Platform (حافلات واحة الأحساء)
-- Supabase Database Schema & Realtime Setup
-- ====================================================================

-- 1. Main Application State Snapshot Table (Fast Live Sync)
CREATE TABLE IF NOT EXISTS public.transit_state (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Persistent Users Table (Cross-device registration & login)
CREATE TABLE IF NOT EXISTS public.transit_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  password TEXT,
  bus_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Persistent Trips Table
CREATE TABLE IF NOT EXISTS public.transit_trips (
  id TEXT PRIMARY KEY,
  driver_id TEXT,
  route_id TEXT,
  status TEXT DEFAULT 'scheduled',
  departure_time TEXT,
  price NUMERIC DEFAULT 4.0,
  current_location JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS) & Grant full access for anon public key
ALTER TABLE public.transit_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transit_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transit_trips ENABLE ROW LEVEL SECURITY;

-- Allow read and write for anon key on transit_state
DROP POLICY IF EXISTS "Public access for transit_state" ON public.transit_state;
CREATE POLICY "Public access for transit_state" ON public.transit_state
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Allow read and write for anon key on transit_users
DROP POLICY IF EXISTS "Public access for transit_users" ON public.transit_users;
CREATE POLICY "Public access for transit_users" ON public.transit_users
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Allow read and write for anon key on transit_trips
DROP POLICY IF EXISTS "Public access for transit_trips" ON public.transit_trips;
CREATE POLICY "Public access for transit_trips" ON public.transit_trips
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Enable Realtime Replication for Tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.transit_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transit_users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transit_trips;
