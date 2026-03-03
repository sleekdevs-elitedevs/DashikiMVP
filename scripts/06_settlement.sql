-- =====================================================
-- SETTLEMENT SYSTEM - Challenge Winner/Loser Logic
-- This script adds settlement tracking and functions
-- =====================================================

-- =====================================================
-- Add settlement columns to challenges table
-- =====================================================
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS current_stake DECIMAL(10, 2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS min_stake DECIMAL(10, 2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS max_stake DECIMAL(10, 2) DEFAULT 100.00,
ADD COLUMN IF NOT EXISTS stake_multiplier DECIMAL(5, 2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS total_pool DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS winners_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS losers_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS settlement_status TEXT CHECK (settlement_status IN ('pending', 'processing', 'settled', 'cancelled')) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS completion_threshold INTEGER DEFAULT 100;  -- Percentage required to complete

-- =====================================================
-- Add settlement columns to challenge_participants table
-- =====================================================
ALTER TABLE public.challenge_participants 
ADD COLUMN IF NOT EXISTS stake_on_join DECIMAL(10, 2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS is_winner BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payout_amount DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE;

-- =====================================================
-- Add payout tracking to user_wallets
-- =====================================================
ALTER TABLE public.user_wallets 
ADD COLUMN IF NOT EXISTS total_winnings DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_forfeited DECIMAL(10, 2) DEFAULT 0.00;

-- =====================================================
-- Create Challenge Settlements Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.challenge_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE,
    total_pool DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    winners_count INTEGER NOT NULL DEFAULT 0,
    losers_count INTEGER NOT NULL DEFAULT 0,
    per_winner_payout DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    platform_fee DECIMAL(10, 2) DEFAULT 0.00,
    status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    settled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.challenge_settlements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view settlements" ON public.challenge_settlements FOR SELECT USING (true);
CREATE POLICY "Anyone can insert settlements" ON public.challenge_settlements FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update settlements" ON public.challenge_settlements FOR UPDATE USING (true);

-- =====================================================
-- Create Settlement Payouts Table (individual winner payouts)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.settlement_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_id UUID REFERENCES public.challenge_settlements(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES public.challenge_participants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE,
    stake_amount DECIMAL(10, 2) NOT NULL,
    payout_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_winner BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT CHECK (status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.settlement_payouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view payouts" ON public.settlement_payouts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert payouts" ON public.settlement_payouts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update payouts" ON public.settlement_payouts FOR UPDATE USING (true);

-- =====================================================
-- Create Indexes for Settlement Tables
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_challenge_settlements_challenge ON public.challenge_settlements(challenge_id);
CREATE INDEX IF NOT EXISTS idx_settlement_payouts_settlement ON public.settlement_payouts(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_payouts_user ON public.settlement_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_settlement_payouts_challenge ON public.settlement_payouts(challenge_id);

-- =====================================================
-- Function: Calculate Stake Based on Challenge Parameters
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_stake(
    p_entry_fee DECIMAL(10, 2),
    p_difficulty TEXT,
    p_participants_count INTEGER
) RETURNS DECIMAL(10, 2) AS $$
DECLARE
    v_stake DECIMAL(10, 2);
    v_difficulty_multiplier DECIMAL(5, 2);
BEGIN
    -- Base difficulty multiplier
    CASE p_difficulty
        WHEN 'Easy' THEN v_difficulty_multiplier := 1.00;
        WHEN 'Medium' THEN v_difficulty_multiplier := 1.50;
        WHEN 'Hard' THEN v_difficulty_multiplier := 2.00;
        ELSE v_difficulty_multiplier := 1.00;
    END CASE;

    -- Calculate base stake
    v_stake := p_entry_fee * v_difficulty_multiplier;

    -- Add participant count factor (more participants = higher stakes)
    -- Each participant adds 5% to the stake pool
    v_stake := v_stake * (1 + (p_participants_count * 0.05));

    -- Cap at reasonable limits
    IF v_stake < 1.00 THEN
        v_stake := 1.00;
    ELSIF v_stake > 1000.00 THEN
        v_stake := 1000.00;
    END IF;

    RETURN ROUND(v_stake, 2);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function: Calculate Potential Reward
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_potential_reward(
    p_stake DECIMAL(10, 2),
    p_participants_count INTEGER,
    p_platform_fee_percent DECIMAL(5, 2) DEFAULT 10.00
) RETURNS DECIMAL(10, 2) AS $$
DECLARE
    v_total_pool DECIMAL(10, 2);
    v_platform_fee DECIMAL(10, 2);
    v_distributable DECIMAL(10, 2);
    v_potential_reward DECIMAL(10, 2);
BEGIN
    -- Calculate total pool from all participants
    v_total_pool := p_stake * p_participants_count;
    
    -- Calculate platform fee (10% default)
    v_platform_fee := v_total_pool * (p_platform_fee_percent / 100);
    
    -- Calculate distributable amount
    v_distributable := v_total_pool - v_platform_fee;
    
    -- Estimate potential reward (assuming 50% win rate for estimation)
    v_potential_reward := v_distributable * 2;
    
    RETURN ROUND(v_potential_reward, 2);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function: Determine Winners Based on Approved Proofs
-- =====================================================
CREATE OR REPLACE FUNCTION public.determine_winners(
    p_challenge_id UUID
) RETURNS TABLE(
    participant_id UUID,
    user_id UUID,
    stake_amount DECIMAL(10, 2),
    proof_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cp.id AS participant_id,
        cp.user_id,
        cp.stake_on_join,
        COUNT(cp2.id)::INTEGER AS proof_count
    FROM public.challenge_participants cp
    LEFT JOIN public.challenge_proofs cp2 
        ON cp2.participant_id = cp.id 
        AND cp2.approved = true
    WHERE cp.challenge_id = p_challenge_id
        AND cp.status = 'completed'
    GROUP BY cp.id, cp.user_id, cp.stake_on_join
    ORDER BY proof_count DESC, cp.completed_at ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function: Settle Challenge (Calculate and Distribute Prizes)
-- =====================================================
CREATE OR REPLACE FUNCTION public.settle_challenge(
    p_challenge_id UUID,
    p_winners_percentage DECIMAL(5, 2) DEFAULT 50.00
) RETURNS UUID AS $$
DECLARE
    v_challenge RECORD;
    v_participant RECORD;
    v_winners INTEGER;
    v_total_pool DECIMAL(10, 2);
    v_platform_fee DECIMAL(10, 2);
    v_distributable DECIMAL(10, 2);
    v_per_winner_payout DECIMAL(10, 2);
    v_settlement_id UUID;
    v_platform_fee_percent CONSTANT DECIMAL(5, 2) := 10.00;
BEGIN
    -- Get challenge details
    SELECT * INTO v_challenge 
    FROM public.challenges 
    WHERE id = p_challenge_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Challenge not found';
    END IF;

    -- Get completed participants count
    SELECT COUNT(*)::INTEGER INTO v_winners
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id
        AND status = 'completed';

    -- If no completions, no settlement
    IF v_winners = 0 THEN
        RAISE NOTICE 'No winners for this challenge';
        RETURN NULL;
    END IF;

    -- Calculate total pool (all joined participants' stakes)
    SELECT COALESCE(SUM(stake_on_join), 0)::DECIMAL(10, 2)
    INTO v_total_pool
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id
        AND status IN ('joined', 'completed');

    -- Calculate platform fee
    v_platform_fee := v_total_pool * (v_platform_fee_percent / 100);
    
    -- Calculate distributable amount
    v_distributable := v_total_pool - v_platform_fee;

    -- Calculate per-winner payout (equal distribution among winners)
    v_per_winner_payout := v_distributable / v_winners;

    -- Create settlement record
    INSERT INTO public.challenge_settlements (
        challenge_id,
        total_pool,
        winners_count,
        losers_count,
        per_winner_payout,
        platform_fee,
        status,
        settled_at
    ) VALUES (
        p_challenge_id,
        v_total_pool,
        v_winners,
        (SELECT COUNT(*) FROM public.challenge_participants WHERE challenge_id = p_challenge_id AND status = 'joined'),
        v_per_winner_payout,
        v_platform_fee,
        'completed',
        NOW()
    )
    RETURNING id INTO v_settlement_id;

    -- Update challenge with settlement info
    UPDATE public.challenges
    SET 
        settlement_status = 'settled',
        winners_count = v_winners,
        total_pool = v_total_pool,
        settled_at = NOW(),
        updated_at = NOW()
    WHERE id = p_challenge_id;

    -- Update participants and create payout records
    FOR v_participant IN 
        SELECT cp.*, p.username
        FROM public.challenge_participants cp
        JOIN public.profiles p ON p.id = cp.user_id
        WHERE cp.challenge_id = p_challenge_id
    LOOP
        IF v_participant.status = 'completed' THEN
            -- Winner - mark and create payout
            UPDATE public.challenge_participants
            SET 
                is_winner = TRUE,
                payout_amount = v_per_winner_payout,
                settled_at = NOW()
            WHERE id = v_participant.id;

            -- Create payout record
            INSERT INTO public.settlement_payouts (
                settlement_id,
                participant_id,
                user_id,
                challenge_id,
                stake_amount,
                payout_amount,
                is_winner,
                status,
                completed_at
            ) VALUES (
                v_settlement_id,
                v_participant.id,
                v_participant.user_id,
                p_challenge_id,
                v_participant.stake_on_join,
                v_per_winner_payout,
                TRUE,
                'completed',
                NOW()
            );

            -- Add winnings to winner's wallet
            UPDATE public.user_wallets
            SET 
                balance = balance + v_per_winner_payout,
                total_earned = total_earned + v_per_winner_payout,
                total_winnings = total_winnings + v_per_winner_payout,
                updated_at = NOW()
            WHERE user_id = v_participant.user_id;

        ELSIF v_participant.status = 'joined' THEN
            -- Loser - mark and record forfeited stake
            UPDATE public.challenge_participants
            SET 
                is_winner = FALSE,
                payout_amount = 0,
                settled_at = NOW()
            WHERE id = v_participant.id;

            -- Create payout record for loser
            INSERT INTO public.settlement_payouts (
                settlement_id,
                participant_id,
                user_id,
                challenge_id,
                stake_amount,
                payout_amount,
                is_winner,
                status,
                completed_at
            ) VALUES (
                v_settlement_id,
                v_participant.id,
                v_participant.user_id,
                p_challenge_id,
                v_participant.stake_on_join,
                0,
                FALSE,
                'completed',
                NOW()
            );

            -- Record forfeited amount
            UPDATE public.user_wallets
            SET 
                total_spent = total_spent + v_participant.stake_on_join,
                total_forfeited = total_forfeited + v_participant.stake_on_join,
                updated_at = NOW()
            WHERE user_id = v_participant.user_id;
        END IF;
    END LOOP;

    RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function: Update Challenge Stake (when participants join/leave)
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_challenge_stake(
    p_challenge_id UUID
) RETURNS VOID AS $$
DECLARE
    v_entry_fee DECIMAL(10, 2);
    v_difficulty TEXT;
    v_participants_count INTEGER;
    v_new_stake DECIMAL(10, 2);
    v_new_potential_reward DECIMAL(10, 2);
BEGIN
    -- Get challenge details
    SELECT entry_fee, difficulty, participants_count
    INTO v_entry_fee, v_difficulty, v_participants_count
    FROM public.challenges
    WHERE id = p_challenge_id;

    -- Calculate new stake
    v_new_stake := public.calculate_stake(v_entry_fee, v_difficulty, v_participants_count);
    
    -- Calculate potential reward
    v_new_potential_reward := public.calculate_potential_reward(
        v_new_stake, 
        v_participants_count
    );

    -- Update challenge
    UPDATE public.challenges
    SET 
        current_stake = v_new_stake,
        potential_reward = v_new_potential_reward,
        updated_at = NOW()
    WHERE id = p_challenge_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Trigger: Auto-update stake when participants change
-- =====================================================
CREATE OR REPLACE FUNCTION public.trigger_update_stake()
RETURNS TRIGGER AS $$
BEGIN
    -- Call the stake update function
    PERFORM public.update_challenge_stake(NEW.challenge_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for participant changes
DROP TRIGGER IF EXISTS trigger_participant_stake_update ON public.challenge_participants;
CREATE TRIGGER trigger_participant_stake_update
    AFTER INSERT OR DELETE ON public.challenge_participants
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_update_stake();

-- =====================================================
-- END OF SETTLEMENT SCRIPT
-- =====================================================
