-- =====================================================
-- Challenge Thumbnails SQL
-- This script adds thumbnail support for challenges
-- =====================================================

-- =====================================================
-- ADD THUMBNAIL COLUMN TO CHALLENGES TABLE
-- =====================================================
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Create index for faster queries on thumbnail
CREATE INDEX IF NOT EXISTS idx_challenges_thumbnail ON public.challenges(thumbnail_url);

-- =====================================================
-- CHALLENGE THUMBNAILS BUCKET (for challenge thumbnail images)
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'challenge-thumbnails',
    'challenge-thumbnails',
    true,
    2097152,  -- 2MB limit (thumbnails should be small)
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for challenge-thumbnails bucket
DROP POLICY IF EXISTS "Challenge thumbnails public read" ON storage.objects;
CREATE POLICY "Challenge thumbnails public read" ON storage.objects
FOR SELECT USING (bucket_id = 'challenge-thumbnails');

DROP POLICY IF EXISTS "Users can upload challenge thumbnails" ON storage.objects;
CREATE POLICY "Users can upload challenge thumbnails" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'challenge-thumbnails');

DROP POLICY IF EXISTS "Users can update challenge thumbnails" ON storage.objects;
CREATE POLICY "Users can update challenge thumbnails" ON storage.objects
FOR UPDATE USING (bucket_id = 'challenge-thumbnails');

DROP POLICY IF EXISTS "Users can delete challenge thumbnails" ON storage.objects;
CREATE POLICY "Users can delete challenge thumbnails" ON storage.objects
FOR DELETE USING (bucket_id = 'challenge-thumbnails');

-- =====================================================
-- END OF CHALLENGE THUMBNAILS SCRIPT
-- =====================================================
