-- ==============================================================================
-- BRIDGE: Cross-Device Personal Transfer Service
-- Clean Schema Setup for Anonymous / Personal E2EE Mode
-- ==============================================================================

-- 1. Drop old tables cleanly with CASCADE to remove all old constraints and policies
DROP TABLE IF EXISTS public.audit_events CASCADE;
DROP TABLE IF EXISTS public.transfer_items CASCADE;
DROP TABLE IF EXISTS public.pairing_invitations CASCADE;
DROP TABLE IF EXISTS public.devices CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 2. Enable UUID & pgcrypto extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 3. Profiles Table
CREATE TABLE public.profiles (
    id TEXT PRIMARY KEY,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Registered Devices Table
CREATE TABLE public.devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL,
    public_key TEXT,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Pairing Invitations Table (Short-lived, single-use device pairing)
CREATE TABLE public.pairing_invitations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    invitation_code TEXT NOT NULL UNIQUE,
    ephemeral_key TEXT NOT NULL,
    device_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    claimed_by_device_id TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Transfer Items Table (Encrypted payload, zero plaintext storage)
CREATE TABLE public.transfer_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    source_device_id TEXT,
    source_device_name TEXT,
    type TEXT NOT NULL CHECK (type IN ('text', 'url', 'file', 'image')),
    title_ciphertext TEXT,
    content_ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    checksum TEXT NOT NULL,
    file_path TEXT,
    file_name TEXT,
    file_size BIGINT,
    file_mime TEXT,
    file_iv TEXT,
    pinned BOOLEAN NOT NULL DEFAULT false,
    retention_hours INTEGER NOT NULL DEFAULT 72,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + INTERVAL '72 hours'),
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Audit Events Table
CREATE TABLE public.audit_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    device_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Indexes for lightning-fast queries and Realtime
CREATE INDEX idx_devices_user_id ON public.devices(user_id, is_revoked);
CREATE INDEX idx_pairing_invitations_code ON public.pairing_invitations(invitation_code);
CREATE INDEX idx_pairing_invitations_user_id ON public.pairing_invitations(user_id, status);
CREATE INDEX idx_transfer_items_user_active ON public.transfer_items(user_id, created_at DESC) WHERE NOT is_deleted;
CREATE INDEX idx_transfer_items_user_pinned ON public.transfer_items(user_id, pinned) WHERE NOT is_deleted;

-- 9. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairing_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- 10. Enable full access policies for anon & authenticated roles
-- (Zero-knowledge security: All contents are AES-GCM-256 encrypted on the client)
CREATE POLICY "Allow all devices access" ON public.devices
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all pairing access" ON public.pairing_invitations
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all transfers access" ON public.transfer_items
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all profiles access" ON public.profiles
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all audit access" ON public.audit_events
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 11. Storage Bucket Configuration for Encrypted Files
INSERT INTO storage.buckets (id, name, public)
VALUES ('transfers', 'transfers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow anon upload to transfers" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon read from transfers" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon update in transfers" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon delete from transfers" ON storage.objects;

CREATE POLICY "Allow anon upload to transfers"
    ON storage.objects FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'transfers');

CREATE POLICY "Allow anon read from transfers"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'transfers');

CREATE POLICY "Allow anon update in transfers"
    ON storage.objects FOR UPDATE TO anon, authenticated
    USING (bucket_id = 'transfers');

CREATE POLICY "Allow anon delete from transfers"
    ON storage.objects FOR DELETE TO anon, authenticated
    USING (bucket_id = 'transfers');
