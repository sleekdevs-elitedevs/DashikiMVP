-- =====================================================
-- Dashiki Storage Buckets
-- This script creates storage buckets for the Dashiki app
-- =====================================================

-- =====================================================
-- AVATARS BUCKET (for user profile pictures)
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    5242880,  -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for avatars bucket
DROP POLICY IF EXISTS "Avatar bucket public read" ON storage.objects;
CREATE POLICY "Avatar bucket public read" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
CREATE POLICY "Users can upload avatars" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::TEXT = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
CREATE POLICY "Users can update own avatars" ON storage.objects
FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::TEXT = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
CREATE POLICY "Users can delete own avatars" ON storage.objects
FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::TEXT = (storage.foldername(name))[1]);

-- =====================================================
-- CHALLENGE PROOFS BUCKET (for challenge completion videos/images)
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'challenge-proofs',
    'challenge-proofs',
    true,
    104857600,  -- 100MB limit for videos
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for challenge-proofs bucket
DROP POLICY IF EXISTS "Proofs bucket public read" ON storage.objects;
CREATE POLICY "Proofs bucket public read" ON storage.objects
FOR SELECT USING (bucket_id = 'challenge-proofs');

DROP POLICY IF EXISTS "Users can upload proofs" ON storage.objects;
CREATE POLICY "Users can upload proofs" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'challenge-proofs' AND auth.uid()::TEXT = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update own proofs" ON storage.objects;
CREATE POLICY "Users can update own proofs" ON storage.objects
FOR UPDATE USING (bucket_id = 'challenge-proofs' AND auth.uid()::TEXT = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete own proofs" ON storage.objects;
CREATE POLICY "Users can delete own proofs" ON storage.objects
FOR DELETE USING (bucket_id = 'challenge-proofs' AND auth.uid()::TEXT = (storage.foldername(name))[1]);

-- =====================================================
-- CHALLENGE IMAGES BUCKET (for challenge cover images)
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'challenge-images',
    'challenge-images',
    true,
    10485760,  -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for challenge-images bucket
DROP POLICY IF EXISTS "Challenge images public read" ON storage.objects;
CREATE POLICY "Challenge images public read" ON storage.objects
FOR SELECT USING (bucket_id = 'challenge-images');

DROP POLICY IF EXISTS "Users can upload challenge images" ON storage.objects;
CREATE POLICY "Users can upload challenge images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'challenge-images');

DROP POLICY IF EXISTS "Users can update challenge images" ON storage.objects;
CREATE POLICY "Users can update challenge images" ON storage.objects
FOR UPDATE USING (bucket_id = 'challenge-images');

DROP POLICY IF EXISTS "Users can delete challenge images" ON storage.objects;
CREATE POLICY "Users can delete challenge images" ON storage.objects
FOR DELETE USING (bucket_id = 'challenge-images');

-- =====================================================
-- END OF STORAGE BUCKETS SCRIPT
-- =====================================================
