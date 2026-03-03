-- =====================================================
-- Random Verification Calls System
-- This script creates tables for scheduling and tracking 
-- random verification calls during challenge time windows
-- =====================================================

-- =====================================================
-- SCHEDULED VERIFICATION CALLS TABLE
-- Tracks scheduled verification calls for challenges
-- =====================================================
CREATE TABLE IF NOT EXISTS public.scheduled_verification_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE NOT NULL,
    scheduled_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    -- 'pending' - scheduled but not sent
    -- 'sent' - notification sent to participant
    -- 'accepted' - participant joined the call
    -- 'completed' - call finished and proof submitted
    -- 'failed' - participant didn't respond
    -- 'cancelled' - cancelled due to time expiry
    call_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying pending calls
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_status 
ON public.scheduled_verification_calls(status) 
WHERE status IN ('pending', 'sent');

-- Index for querying by challenge
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_challenge 
ON public.scheduled_verification_calls(challenge_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_time 
ON public.scheduled_verification_calls(scheduled_time);

-- =====================================================
-- VERIFICATION CALL PARTICIPANTS TABLE
-- Tracks which participants are selected for verification calls
-- =====================================================
CREATE TABLE IF NOT EXISTS public.verification_call_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scheduled_call_id UUID REFERENCES public.scheduled_verification_calls(id) ON DELETE CASCADE NOT NULL,
    participant_id UUID REFERENCES public.challenge_participants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    selection_order INTEGER DEFAULT 0,
    max_calls_allowed INTEGER DEFAULT 2,
    calls_completed INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'selected',
    -- 'selected' - selected for this call
    -- 'notified' - notification sent
    -- 'responded' - participant accepted
    -- 'completed' - call completed successfully
    -- 'declined' - participant declined
    -- 'no_response' - participant didn't respond
    last_call_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (scheduled_call_id, participant_id)
);

-- Index for querying by scheduled call
CREATE INDEX IF NOT EXISTS idx_call_participants_scheduled_call 
ON public.verification_call_participants(scheduled_call_id);

-- Index for querying by participant/user
CREATE INDEX IF NOT EXISTS idx_call_participants_user 
ON public.verification_call_participants(user_id);

-- =====================================================
-- VERIFICATION CALL PROOFS TABLE
-- Stores call recordings/proofs after completion
-- =====================================================
CREATE TABLE IF NOT EXISTS public.verification_call_proofs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scheduled_call_id UUID REFERENCES public.scheduled_verification_calls(id) ON DELETE CASCADE NOT NULL,
    participant_id UUID REFERENCES public.challenge_participants(id) ON DELETE CASCADE NOT NULL,
    call_duration INTEGER,
    call_recording_url TEXT,
    participant_responded BOOLEAN DEFAULT false,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by scheduled call
CREATE INDEX IF NOT EXISTS idx_call_proofs_scheduled_call 
ON public.verification_call_proofs(scheduled_call_id);

-- Index for querying by participant
CREATE INDEX IF NOT EXISTS idx_call_proofs_participant 
ON public.verification_call_proofs(participant_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- RLS for scheduled_verification_calls
ALTER TABLE public.scheduled_verification_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view scheduled calls" 
ON public.scheduled_verification_calls FOR SELECT USING (true);

CREATE POLICY "System can insert scheduled calls" 
ON public.scheduled_verification_calls FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update scheduled calls" 
ON public.scheduled_verification_calls FOR UPDATE USING (true);

CREATE POLICY "System can delete scheduled calls" 
ON public.scheduled_verification_calls FOR DELETE USING (true);

-- RLS for verification_call_participants
ALTER TABLE public.verification_call_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view call participants" 
ON public.verification_call_participants FOR SELECT USING (true);

CREATE POLICY "System can insert call participants" 
ON public.verification_call_participants FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update call participants" 
ON public.verification_call_participants FOR UPDATE USING (true);

CREATE POLICY "System can delete call participants" 
ON public.verification_call_participants FOR DELETE USING (true);

-- RLS for verification_call_proofs
ALTER TABLE public.verification_call_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view call proofs" 
ON public.verification_call_proofs FOR SELECT USING (true);

CREATE POLICY "System can insert call proofs" 
ON public.verification_call_proofs FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update call proofs" 
ON public.verification_call_proofs FOR UPDATE USING (true);

CREATE POLICY "System can delete call proofs" 
ON public.verification_call_proofs FOR DELETE USING (true);

-- =====================================================
-- FUNCTION: Schedule random verification calls
-- Called when challenge starts to schedule calls within time window
-- =====================================================
CREATE OR REPLACE FUNCTION public.schedule_verification_calls(p_challenge_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_challenge RECORD;
    v_participants RECORD;
    v_random_participants UUID[];
    v_max_calls INTEGER;
    v_call_count INTEGER := 0;
    v_start_time TIMESTAMPTZ;
    v_end_time TIMESTAMPTZ;
    v_schedule_interval INTERVAL;
    v_call_time TIMESTAMPTZ;
    v_participant_count INTEGER;
    v_new_call_id UUID;
BEGIN
    -- Get challenge details
    SELECT * INTO v_challenge 
    FROM public.challenges 
    WHERE id = p_challenge_id;

    IF v_challenge IS NULL THEN
        RAISE EXCEPTION 'Challenge not found';
    END IF;

    -- Get max random calls for this challenge (default to 2)
    v_max_calls := COALESCE(v_challenge.max_random_calls, 2);
    
    -- Get active participants count
    SELECT COUNT(*) INTO v_participant_count
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id 
    AND status = 'active';

    -- If no participants, return 0
    IF v_participant_count = 0 THEN
        RETURN 0;
    END IF;

    -- Calculate time window
    v_start_time := NOW();
    v_end_time := v_start_time + (INTERVAL '1 day' * COALESCE(v_challenge.days_left, 1));
    v_schedule_interval := (v_end_time - v_start_time) / GREATEST(v_max_calls, 1);

    -- Select random participants (up to max_calls, but not more than participants)
    FOR v_participants IN 
        SELECT cp.id, cp.user_id
        FROM public.challenge_participants cp
        WHERE cp.challenge_id = p_challenge_id 
        AND cp.status = 'active'
        ORDER BY RANDOM()
        LIMIT LEAST(v_max_calls, v_participant_count)
    LOOP
        -- Schedule a call for this participant
        v_call_time := v_start_time + (v_schedule_interval * v_call_count);
        
        INSERT INTO public.scheduled_verification_calls (
            challenge_id,
            scheduled_time,
            status
        ) VALUES (
            p_challenge_id,
            v_call_time,
            'pending'
        )
        RETURNING id INTO v_new_call_id;
        
        -- Insert participant selection
        INSERT INTO public.verification_call_participants (
            scheduled_call_id,
            participant_id,
            user_id,
            selection_order,
            max_calls_allowed,
            status
        ) VALUES (
            v_new_call_id,
            v_participants.id,
            v_participants.user_id,
            v_call_count + 1,
            v_max_calls,
            'selected'
        )
        ON CONFLICT DO NOTHING;
        
        v_call_count := v_call_count + 1;
    END LOOP;

    RAISE NOTICE 'Scheduled % verification calls for challenge %', v_call_count, p_challenge_id;
    RETURN v_call_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Process pending verification calls
-- Called by cron job to send notifications and process calls
-- =====================================================
CREATE OR REPLACE FUNCTION public.process_verification_calls()
RETURNS INTEGER AS $$
DECLARE
    v_pending_call RECORD;
    v_participant RECORD;
    v_calls_processed INTEGER := 0;
    v_call_id VARCHAR(255);
BEGIN
    -- Process pending calls that are due
    FOR v_pending_call IN
        SELECT svc.*, c.max_random_calls
        FROM public.scheduled_verification_calls svc
        JOIN public.challenges c ON c.id = svc.challenge_id
        WHERE svc.status = 'pending'
        AND svc.scheduled_time <= NOW()
        ORDER BY svc.scheduled_time ASC
        LIMIT 10
    LOOP
        -- Get a random active participant who hasn't exceeded max calls
        SELECT cp.id, cp.user_id, vcp.calls_completed
        INTO v_participant
        FROM public.challenge_participants cp
        LEFT JOIN public.verification_call_participants vcp 
            ON vcp.participant_id = cp.id 
            AND vcp.scheduled_call_id = v_pending_call.id
        WHERE cp.challenge_id = v_pending_call.challenge_id
        AND cp.status = 'active'
        AND (vcp.calls_completed IS NULL OR vcp.calls_completed < COALESCE(v_pending_call.max_random_calls, 2))
        ORDER BY RANDOM()
        LIMIT 1;

        IF v_participant IS NOT NULL THEN
            -- Generate call ID
            v_call_id := 'verify-' || v_pending_call.id::TEXT || '-' || EXTRACT(EPOCH FROM NOW())::INTEGER;

            -- Update call status
            UPDATE public.scheduled_verification_calls
            SET status = 'sent',
                call_id = v_call_id,
                updated_at = NOW()
            WHERE id = v_pending_call.id;

            -- Update participant status to notified
            UPDATE public.verification_call_participants
            SET status = 'notified',
                updated_at = NOW()
            WHERE scheduled_call_id = v_pending_call.id
            AND participant_id = v_participant.id;

            v_calls_processed := v_calls_processed + 1;
        ELSE
            -- No eligible participants, mark as cancelled
            UPDATE public.scheduled_verification_calls
            SET status = 'cancelled',
                updated_at = NOW()
            WHERE id = v_pending_call.id;
        END IF;

        v_participant := NULL;
    END LOOP;

    RAISE NOTICE 'Processed % verification calls', v_calls_processed;
    RETURN v_calls_processed;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Cron Job Setup (Uncomment to enable)
-- Runs every minute to check for pending verification calls
-- =====================================================
-- SELECT cron.schedule(
--     'process-verification-calls',
--     '* * * * *',
--     'SELECT public.process_verification_calls();'
-- );

-- To unschedule:
-- SELECT cron.unschedule('process-verification-calls');

-- =====================================================
-- END OF RANDOM VERIFICATION CALLS SCRIPT
-- =====================================================
