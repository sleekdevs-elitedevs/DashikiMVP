-- =====================================================
-- AUTOMATIC SETTLEMENT SYSTEM - Cron Job
-- This script creates functions for automatic challenge settlement
-- that runs every 10 minutes to:
-- 1. Check challenges that have ended
-- 2. Mark winners based on approved proofs
-- 3. Update wallets (winners get paid, losers lose stake)
-- 4. Create transactions for all participants
-- 5. Send notifications to users
-- 6. Update challenge status to settled
-- =====================================================

-- =====================================================
-- Add required columns if not exists
-- =====================================================
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_settle BOOLEAN DEFAULT TRUE;

-- =====================================================
-- Function: Process Challenge Settlement
-- This is the main function that settles a single challenge
-- =====================================================
CREATE OR REPLACE FUNCTION public.process_challenge_settlement(p_challenge_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_challenge RECORD;
    v_participant RECORD;
    v_winners INTEGER;
    v_losers INTEGER;
    v_total_pool DECIMAL(10, 2);
    v_platform_fee DECIMAL(10, 2);
    v_distributable DECIMAL(10, 2);
    v_per_winner_payout DECIMAL(10, 2);
    v_platform_fee_percent CONSTANT DECIMAL(5, 2) := 10.00;
    v_settlement_id UUID;
    v_challenge_title TEXT;
    v_notification_title TEXT;
    v_notification_message TEXT;
BEGIN
    -- Get challenge details
    SELECT * INTO v_challenge 
    FROM public.challenges 
    WHERE id = p_challenge_id;

    IF NOT FOUND THEN
        RAISE NOTICE 'Challenge not found: %', p_challenge_id;
        RETURN FALSE;
    END IF;

    -- Skip if already settled
    IF v_challenge.settlement_status = 'settled' THEN
        RAISE NOTICE 'Challenge already settled: %', p_challenge_id;
        RETURN FALSE;
    END IF;

    -- Get challenge title for notifications
    v_challenge_title := v_challenge.title;

    -- Get count of winners (participants with approved proofs)
    SELECT COUNT(*)::INTEGER INTO v_winners
    FROM public.challenge_participants cp
    INNER JOIN public.challenge_proofs cp2 
        ON cp2.participant_id = cp.id 
        AND cp2.approved = true
    WHERE cp.challenge_id = p_challenge_id
        AND cp.status IN ('joined', 'completed');

    -- Get count of losers (participants without approved proofs)
    SELECT COUNT(*)::INTEGER INTO v_losers
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id
        AND status IN ('joined', 'completed')
        AND id NOT IN (
            SELECT cp.id
            FROM public.challenge_participants cp
            INNER JOIN public.challenge_proofs cp2 
                ON cp2.participant_id = cp.id 
                AND cp2.approved = true
            WHERE cp.challenge_id = p_challenge_id
        );

    -- If no winners, no settlement
    IF v_winners = 0 THEN
        -- Update challenge as cancelled (no winners)
        UPDATE public.challenges
        SET 
            settlement_status = 'cancelled',
            settled_at = NOW(),
            updated_at = NOW()
        WHERE id = p_challenge_id;
        
        RAISE NOTICE 'Challenge cancelled (no winners): %', p_challenge_id;
        RETURN FALSE;
    END IF;

    -- Calculate total pool (all joined participants' stakes)
    SELECT COALESCE(SUM(stake_on_join), 0)::DECIMAL(10, 2) INTO v_total_pool
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
        v_losers,
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
        losers_count = v_losers,
        total_pool = v_total_pool,
        settled_at = NOW(),
        updated_at = NOW()
    WHERE id = p_challenge_id;

    -- Process each participant
    FOR v_participant IN 
        SELECT cp.*, p.username
        FROM public.challenge_participants cp
        JOIN public.profiles p ON p.id = cp.user_id
        WHERE cp.challenge_id = p_challenge_id
            AND cp.status IN ('joined', 'completed')
    LOOP
        -- Check if participant has approved proof
        IF EXISTS (
            SELECT 1 FROM public.challenge_proofs 
            WHERE participant_id = v_participant.id 
            AND approved = true
        ) THEN
            -- WINNER - Update participant and wallet
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

            -- Create transaction for winner (income)
            INSERT INTO public.transactions (
                user_id,
                title,
                amount,
                type,
                category,
                date
            ) VALUES (
                v_participant.user_id,
                '🏆 Won: ' || v_challenge_title,
                v_per_winner_payout,
                'income',
                'challenge_winnings',
                NOW()::DATE
            );

            -- Send notification to winner
            v_notification_title := '🎉 Challenge Won!';
            v_notification_message := 'Congratulations! You won "' || v_challenge_title || '" and earned $' || v_per_winner_payout::TEXT || '!';
            
            INSERT INTO public.notifications (
                user_id,
                title,
                message,
                type,
                challenge_id
            ) VALUES (
                v_participant.user_id,
                v_notification_title,
                v_notification_message,
                'reward',
                p_challenge_id
            );

        ELSE
            -- LOSER - Mark as loser and record forfeited stake
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

            -- Create transaction for loser (expense)
            INSERT INTO public.transactions (
                user_id,
                title,
                amount,
                type,
                category,
                date
            ) VALUES (
                v_participant.user_id,
                '❌ Lost: ' || v_challenge_title,
                v_participant.stake_on_join,
                'expense',
                'challenge_loss',
                NOW()::DATE
            );

            -- Send notification to loser
            v_notification_title := '😔 Challenge Ended';
            v_notification_message := 'The challenge "' || v_challenge_title || '" has ended. You lost $' || v_participant.stake_on_join::TEXT || '. Better luck next time!';
            
            INSERT INTO public.notifications (
                user_id,
                title,
                message,
                type,
                challenge_id
            ) VALUES (
                v_participant.user_id,
                v_notification_title,
                v_notification_message,
                'challenge',
                p_challenge_id
            );
        END IF;
    END LOOP;

    RAISE NOTICE 'Challenge settled successfully: %', p_challenge_id;
    RETURN TRUE;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error settling challenge %: %', p_challenge_id, SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function: Cron Job - Process All Due Settlements
-- This function should be called by a cron job every 10 minutes
-- =====================================================
CREATE OR REPLACE FUNCTION public.cron_settle_challenges()
RETURNS INTEGER AS $$
DECLARE
    v_challenges_processed INTEGER := 0;
    v_challenge RECORD;
    v_current_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- Find challenges that need to be settled:
    -- 1. Challenge has ended (end_date passed) OR days_left <= 0
    -- 2. Auto-settle is enabled
    -- 3. Not already settled
    -- 4. Has at least one participant with approved proof
    
    FOR v_challenge IN
        SELECT c.id, c.title, c.end_date, c.days_left, c.settlement_status
        FROM public.challenges c
        WHERE c.auto_settle = TRUE
            AND c.settlement_status IN ('pending', 'processing')
            AND c.status = 'Active'
            AND (
                -- Either end_date has passed
                (c.end_date IS NOT NULL AND c.end_date <= v_current_time)
                -- Or days_left is 0 or negative
                OR (c.days_left IS NOT NULL AND c.days_left <= 0)
            )
            -- Must have at least one participant with approved proof
            AND EXISTS (
                SELECT 1 FROM public.challenge_participants cp
                INNER JOIN public.challenge_proofs cp2 
                    ON cp2.participant_id = cp.id 
                    AND cp2.approved = true
                WHERE cp.challenge_id = c.id
            )
    LOOP
        -- Mark as processing
        UPDATE public.challenges
        SET settlement_status = 'processing'
        WHERE id = v_challenge.id;

        -- Process the settlement
        IF public.process_challenge_settlement(v_challenge.id) THEN
            v_challenges_processed := v_challenges_processed + 1;
        END IF;
    END LOOP;

    -- Also check challenges that might have been stuck in 'processing' for too long
    FOR v_challenge IN
        SELECT c.id
        FROM public.challenges c
        WHERE c.settlement_status = 'processing'
            AND c.updated_at < (v_current_time - INTERVAL '1 hour')
    LOOP
        -- Try to settle again (might have failed previously)
        IF public.process_challenge_settlement(v_challenge.id) THEN
            v_challenges_processed := v_challenges_processed + 1;
        END IF;
    END LOOP;

    RAISE NOTICE 'Processed % challenges', v_challenges_processed;
    RETURN v_challenges_processed;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function: Manual Trigger - Start Settlement for a Challenge
-- Can be called manually to trigger settlement
-- =====================================================
CREATE OR REPLACE FUNCTION public.trigger_settlement(p_challenge_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_challenge RECORD;
BEGIN
    -- Get challenge
    SELECT * INTO v_challenge
    FROM public.challenges
    WHERE id = p_challenge_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Challenge not found';
    END IF;

    -- Check if already settled
    IF v_challenge.settlement_status = 'settled' THEN
        RAISE EXCEPTION 'Challenge already settled';
    END IF;

    -- Check if has participants with proofs
    IF NOT EXISTS (
        SELECT 1 FROM public.challenge_participants cp
        INNER JOIN public.challenge_proofs cp2 
            ON cp2.participant_id = cp.id 
            AND cp2.approved = true
        WHERE cp.challenge_id = p_challenge_id
    ) THEN
        RAISE EXCEPTION 'No approved proofs found for this challenge';
    END IF;

    -- Mark as processing
    UPDATE public.challenges
    SET settlement_status = 'processing'
    WHERE id = p_challenge_id;

    -- Process settlement
    RETURN public.process_challenge_settlement(p_challenge_id);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Create pg_cron job to run every 10 minutes
-- NOTE: Enable pg_cron extension first in your database:
-- CREATE EXTENSION pg_cron;
--
-- Then schedule the job:
-- SELECT cron.schedule(
--     'settle-challenges', 
--     '*/10 * * * *', 
--     'SELECT public.cron_settle_challenges();'
-- );
--
-- To unschedule:
-- SELECT cron.unschedule('settle-challenges');
-- =====================================================

-- =====================================================
-- Optional: Create a view for past events/challenges
-- =====================================================
CREATE OR REPLACE VIEW public.past_challenges AS
SELECT 
    c.id,
    c.title,
    c.description,
    c.category,
    c.difficulty,
    c.status,
    c.entry_fee,
    c.potential_reward,
    c.current_stake,
    c.total_pool,
    c.winners_count,
    c.losers_count,
    c.settlement_status,
    c.settled_at,
    c.created_at,
    c.end_date,
    c.days_left,
    (SELECT COUNT(*) FROM public.challenge_participants WHERE challenge_id = c.id) as participant_count,
    (SELECT COUNT(*) FROM public.challenge_proofs cp 
     INNER JOIN public.challenge_participants cp2 ON cp2.id = cp.participant_id 
     WHERE cp2.challenge_id = c.id AND cp.approved = true) as approved_proofs_count
FROM public.challenges c
WHERE c.settlement_status IN ('settled', 'cancelled')
    OR c.status = 'Completed'
    OR c.days_left <= 0
ORDER BY c.settled_at DESC NULLS LAST, c.created_at DESC;

-- =====================================================
-- Optional: Create view for user settlement history
-- =====================================================
CREATE OR REPLACE VIEW public.user_settlement_history AS
SELECT 
    sp.id as payout_id,
    sp.user_id,
    sp.challenge_id,
    c.title as challenge_title,
    c.category,
    c.difficulty,
    sp.stake_amount,
    sp.payout_amount,
    sp.is_winner,
    sp.status as payout_status,
    sp.completed_at,
    cs.total_pool,
    cs.winners_count,
    cs.losers_count
FROM public.settlement_payouts sp
INNER JOIN public.challenges c ON c.id = sp.challenge_id
LEFT JOIN public.challenge_settlements cs ON cs.challenge_id = sp.challenge_id
ORDER BY sp.completed_at DESC;

-- =====================================================
-- END OF SETTLEMENT CRON SCRIPT
-- =====================================================
