-- =====================================================
-- Add max_random_calls column to challenges table
-- =====================================================

-- Add the column with default value of 2
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS max_random_calls INTEGER DEFAULT 2;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_challenges_max_random_calls ON public.challenges(max_random_calls);

-- =====================================================
-- END OF max_random_calls SCRIPT
-- =====================================================
