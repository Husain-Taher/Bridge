-- ==============================================================================
-- BRIDGE: Cross-Device Personal Transfer Service
-- Production Database Migration & Row Level Security (RLS)
-- ==============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Registered Devices Table
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL CHECK (device_type IN ('laptop', 'phone', 'tablet', 'browser_extension', 'other')),
    public_key TEXT,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Pairing Invitations Table (Short-lived, single-use device pairing)
CREATE TABLE IF NOT EXISTS public.pairing_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invitation_code TEXT NOT NULL UNIQUE,
    ephemeral_key TEXT NOT NULL,
    device_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'claimed', 'expired', 'revoked')),
    claimed_by_device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Transfer Items Table (Encrypted payload, zero plaintext storage)
CREATE TABLE IF NOT EXISTS public.transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
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

-- 5. Audit Events Table
CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performant filtering, search, and cleanup
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id, is_revoked);
CREATE INDEX IF NOT EXISTS idx_pairing_invitations_code ON public.pairing_invitations(invitation_code);
CREATE INDEX IF NOT EXISTS idx_pairing_invitations_user_id ON public.pairing_invitations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_transfer_items_user_active ON public.transfer_items(user_id, created_at DESC) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_transfer_items_user_type ON public.transfer_items(user_id, type) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_transfer_items_user_pinned ON public.transfer_items(user_id, pinned) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_transfer_items_expires ON public.transfer_items(expires_at) WHERE NOT is_deleted;

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairing_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- RLS POLICIES: Strict user-boundary enforcement (Idempotent)
-- -----------------------------------------------------------------------------

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Devices Policies
DROP POLICY IF EXISTS "Users can view own registered devices" ON public.devices;
CREATE POLICY "Users can view own registered devices"
    ON public.devices FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own devices" ON public.devices;
CREATE POLICY "Users can insert own devices"
    ON public.devices FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own devices" ON public.devices;
CREATE POLICY "Users can update own devices"
    ON public.devices FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own devices" ON public.devices;
CREATE POLICY "Users can delete own devices"
    ON public.devices FOR DELETE
    USING (auth.uid() = user_id);

-- Pairing Invitations Policies
DROP POLICY IF EXISTS "Users can view own pairing invitations" ON public.pairing_invitations;
CREATE POLICY "Users can view own pairing invitations"
    ON public.pairing_invitations FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own pairing invitations" ON public.pairing_invitations;
CREATE POLICY "Users can insert own pairing invitations"
    ON public.pairing_invitations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own pairing invitations" ON public.pairing_invitations;
CREATE POLICY "Users can update own pairing invitations"
    ON public.pairing_invitations FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own pairing invitations" ON public.pairing_invitations;
CREATE POLICY "Users can delete own pairing invitations"
    ON public.pairing_invitations FOR DELETE
    USING (auth.uid() = user_id);

-- Transfer Items Policies
DROP POLICY IF EXISTS "Users can view own active transfer items" ON public.transfer_items;
CREATE POLICY "Users can view own active transfer items"
    ON public.transfer_items FOR SELECT
    USING (auth.uid() = user_id AND NOT is_deleted);

DROP POLICY IF EXISTS "Users can insert own transfer items" ON public.transfer_items;
CREATE POLICY "Users can insert own transfer items"
    ON public.transfer_items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own transfer items" ON public.transfer_items;
CREATE POLICY "Users can update own transfer items"
    ON public.transfer_items FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can soft-delete or hard-delete own items" ON public.transfer_items;
CREATE POLICY "Users can soft-delete or hard-delete own items"
    ON public.transfer_items FOR DELETE
    USING (auth.uid() = user_id);

-- Audit Events Policies
DROP POLICY IF EXISTS "Users can view own audit events" ON public.audit_events;
CREATE POLICY "Users can view own audit events"
    ON public.audit_events FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own audit events" ON public.audit_events;
CREATE POLICY "Users can insert own audit events"
    ON public.audit_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- AUTOMATIC PROFILE CREATION TRIGGER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Bridge User'));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- STORAGE CONFIGURATION & POLICIES (Supabase Storage: 'transfers')
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'transfers',
    'transfers',
    false, -- Private bucket
    52428800, -- 50MB per file limit
    NULL -- All MIME types accepted as encrypted blobs
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: allow authenticated users to manage files in their own folder
DROP POLICY IF EXISTS "Users can read own encrypted transfers" ON storage.objects;
CREATE POLICY "Users can read own encrypted transfers"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'transfers' 
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users can upload own encrypted transfers" ON storage.objects;
CREATE POLICY "Users can upload own encrypted transfers"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'transfers'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users can update own encrypted transfers" ON storage.objects;
CREATE POLICY "Users can update own encrypted transfers"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'transfers'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users can delete own encrypted transfers" ON storage.objects;
CREATE POLICY "Users can delete own encrypted transfers"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'transfers'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Enable Realtime publication for transfer_items table safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'transfer_items'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.transfer_items;
    END IF;
END $$;
