-- Supabase Storage Setup for Tutorial Thumbnails
-- 
-- Run this SQL in your Supabase SQL Editor to create the storage bucket and policies

-- Create storage bucket for tutorial thumbnails
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tutorials',
  'tutorials',
  true,
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Public Read Access for Tutorials" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload for Tutorials" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update for Tutorials" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete for Tutorials" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload for Tutorials" ON storage.objects;
DROP POLICY IF EXISTS "Public Update for Tutorials" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete for Tutorials" ON storage.objects;

-- Policy: Allow public read access to tutorial thumbnails
CREATE POLICY "Public Read Access for Tutorials"
ON storage.objects FOR SELECT
USING (bucket_id = 'tutorials');

-- Policy: Allow public upload for tutorial thumbnails (for admin panel)
CREATE POLICY "Public Upload for Tutorials"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tutorials');

-- Policy: Allow public update for tutorial thumbnails (for admin panel)
CREATE POLICY "Public Update for Tutorials"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tutorials');

-- Policy: Allow public delete for tutorial thumbnails (for admin panel)
CREATE POLICY "Public Delete for Tutorials"
ON storage.objects FOR DELETE
USING (bucket_id = 'tutorials');

