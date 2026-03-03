-- =====================================================
-- CHALLENGE INVITATIONS TABLE
-- This script creates the challenge_invitations table for inviting friends to challenges
-- =====================================================

-- =====================================================
-- CHALLENGE INVITATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.challenge_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE NOT NULL,
    inviter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    invitee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')) DEFAULT 'pending',
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(challenge_id, inviter_id, invitee_id)
);

-- Enable RLS
ALTER TABLE public.challenge_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for challenge_invitations
CREATE POLICY "Users can view their challenge invitations" ON public.challenge_invitations FOR SELECT 
    USING (inviter_id = auth.uid() OR invitee_id = auth.uid());

CREATE POLICY "Users can send challenge invitations" ON public.challenge_invitations FOR INSERT 
    WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Users can update challenge invitations" ON public.challenge_invitations FOR UPDATE 
    USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "Users can delete challenge invitations" ON public.challenge_invitations FOR DELETE 
    USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_challenge_invitations_challenge ON public.challenge_invitations(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_invitations_inviter ON public.challenge_invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_challenge_invitations_invitee ON public.challenge_invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_challenge_invitations_status ON public.challenge_invitations(status);

-- =====================================================
-- FUNCTION TO NOTIFY INVITEE ON NEW INVITATION
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_challenge_invitation()
RETURNS TRIGGER AS $$
BEGIN
    -- Create a notification for the invitee
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
        NEW.invitee_id,
        'New Challenge Invitation',
        'You have been invited to join a challenge!',
        'challenge'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new challenge invitation
CREATE TRIGGER on_challenge_invitation_created
    AFTER INSERT ON public.challenge_invitations
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_challenge_invitation();

-- =====================================================
-- FUNCTION TO NOTIFY INVITER ON ACCEPT/REJECT
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_challenge_invitation_response()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify if status changed
    IF OLD.status != NEW.status THEN
        IF NEW.status = 'accepted' THEN
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (
                NEW.inviter_id,
                'Invitation Accepted',
                'Your challenge invitation has been accepted!',
                'challenge'
            );
        ELSIF NEW.status = 'rejected' THEN
            INSERT INTO public.notifications (user_id, title, message, type)
            VALUES (
                NEW.inviter_id,
                'Invitation Declined',
                'Your challenge invitation has been declined.',
                'challenge'
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for invitation response
CREATE TRIGGER on_challenge_invitation_updated
    AFTER UPDATE ON public.challenge_invitations
    FOR EACH ROW EXECUTE FUNCTION public.handle_challenge_invitation_response();

-- =====================================================
-- END OF CHALLENGE INVITATIONS TABLE SCRIPT
-- =====================================================
