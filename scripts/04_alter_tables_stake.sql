-- =====================================================
-- ALTER TABLES - Add Stake Columns
-- This script adds stake-related columns to challenges and challenge_participants tables
-- =====================================================

-- =====================================================
-- Add current_stake column to challenges table
-- =====================================================
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS current_stake DECIMAL(10, 2) DEFAULT 1.00;

-- =====================================================
-- Add stake_on_join column to challenge_participants table
-- =====================================================
ALTER TABLE public.challenge_participants 
ADD COLUMN IF NOT EXISTS stake_on_join DECIMAL(10, 2) DEFAULT 1.00;

-- =====================================================
-- END OF ALTER TABLES SCRIPT
-- =====================================================
