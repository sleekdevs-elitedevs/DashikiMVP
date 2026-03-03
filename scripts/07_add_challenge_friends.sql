-- =====================================================
-- ADD FRIENDS COLUMN TO CHALLENGES TABLE
-- This script adds a friends column to store array of friend IDs
-- =====================================================

-- Add friends column to challenges table (array of UUIDs)
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS friends UUID[] DEFAULT '{}';

-- Add index for better query performance on friends array
CREATE INDEX IF NOT EXISTS idx_challenges_friends ON public.challenges USING GIN (friends);

-- =====================================================
-- END OF SCRIPT
-- =====================================================
