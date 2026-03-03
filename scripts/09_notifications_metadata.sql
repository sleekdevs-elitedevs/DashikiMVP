-- =====================================================
-- NOTIFICATIONS METADATA MIGRATION
-- This script adds metadata fields to notifications for challenge invitations
-- =====================================================

-- =====================================================
-- ADD COLUMNS TO NOTIFICATIONS TABLE
-- =====================================================

-- Add source_user_id to track who sent the notification (e.g., who invited)
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS source_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add challenge_id to link to the challenge being invited to
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES public.challenges(id) ON DELETE SET NULL;

-- Add potential_reward to show how much they can win
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS potential_reward DECIMAL(10, 2) DEFAULT 0;

-- Add challenge_title for easy access to the challenge name
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS challenge_title TEXT;

-- =====================================================
-- INDEXES FOR NEW COLUMNS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_notifications_source_user ON public.notifications(source_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_challenge ON public.notifications(challenge_id);

-- =====================================================
-- UPDATE TRIGGER FUNCTION TO INCLUDE METADATA
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_challenge_invitation()
RETURNS TRIGGER AS $$
DECLARE
    v_challenge_title TEXT;
    v_potential_reward DECIMAL(10, 2);
    v_inviter_username TEXT;
BEGIN
    -- Get challenge details
    SELECT c.title, c.potential_reward INTO v_challenge_title, v_potential_reward
    FROM public.challenges c
    WHERE c.id = NEW.challenge_id;

    -- Get inviter's username
    SELECT p.username INTO v_inviter_username
    FROM public.profiles p
    WHERE p.id = NEW.inviter_id;

    -- Create a notification with detailed information
    INSERT INTO public.notifications (user_id, title, message, type, source_user_id, challenge_id, potential_reward, challenge_title)
    VALUES (
        NEW.invitee_id,
        'New Challenge Invitation',
        COALESCE(v_inviter_username, 'Someone') || ' invited you to join "' || COALESCE(v_challenge_title, 'a challenge') || '"! Win up to $' || COALESCE(v_potential_reward::TEXT, '0') || '!',
        'challenge',
        NEW.inviter_id,
        NEW.challenge_id,
        COALESCE(v_potential_reward, 0),
        v_challenge_title
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- UPDATE RESPONSE TRIGGER TO INCLUDE METADATA
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_challenge_invitation_response()
RETURNS TRIGGER AS $$
DECLARE
    v_challenge_title TEXT;
    v_potential_reward DECIMAL(10, 2);
    v_invitee_username TEXT;
BEGIN
    -- Only notify if status changed
    IF OLD.status != NEW.status THEN
        -- Get challenge and invitee details
        SELECT c.title, c.potential_reward INTO v_challenge_title, v_potential_reward
        FROM public.challenges c
        WHERE c.id = NEW.challenge_id;

        SELECT p.username INTO v_invitee_username
        FROM public.profiles p
        WHERE p.id = NEW.invitee_id;

        IF NEW.status = 'accepted' THEN
            INSERT INTO public.notifications (user_id, title, message, type, source_user_id, challenge_id, potential_reward, challenge_title)
            VALUES (
                NEW.inviter_id,
                'Invitation Accepted',
                COALESCE(v_invitee_username, 'Someone') || ' accepted your invitation to "' || COALESCE(v_challenge_title, 'the challenge') || '"!',
                'challenge',
                NEW.invitee_id,
                NEW.challenge_id,
                COALESCE(v_potential_reward, 0),
                v_challenge_title
            );
        ELSIF NEW.status = 'rejected' THEN
            INSERT INTO public.notifications (user_id, title, message, type, source_user_id, challenge_id, potential_reward, challenge_title)
            VALUES (
                NEW.inviter_id,
                'Invitation Declined',
                COALESCE(v_invitee_username, 'Someone') || ' declined your invitation to "' || COALESCE(v_challenge_title, 'the challenge') || '".',
                'challenge',
                NEW.invitee_id,
                NEW.challenge_id,
                COALESCE(v_potential_reward, 0),
                v_challenge_title
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- END OF NOTIFICATIONS METADATA MIGRATION
-- =====================================================
