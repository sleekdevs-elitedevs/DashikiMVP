-- =====================================================
-- USER PUSH TOKENS TABLE
-- This script creates the user_push_tokens table for storing device push tokens
-- =====================================================

-- =====================================================
-- USER PUSH TOKENS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    push_token TEXT NOT NULL,
    device_type TEXT CHECK (device_type IN ('ios', 'android', 'web')) DEFAULT 'android',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, push_token)
);

-- Enable RLS
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_push_tokens
CREATE POLICY "Users can view their own push tokens" ON public.user_push_tokens FOR SELECT 
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own push tokens" ON public.user_push_tokens FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens" ON public.user_push_tokens FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push tokens" ON public.user_push_tokens FOR DELETE 
    USING (auth.uid() = user_id);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user ON public.user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_active ON public.user_push_tokens(user_id) WHERE is_active = TRUE;

-- =====================================================
-- FUNCTION TO NOTIFY USER ON NEW CHALLENGE INVITATION (PUSH NOTIFICATION)
-- =====================================================
CREATE OR REPLACE FUNCTION public.send_push_notification_on_invitation()
RETURNS TRIGGER AS $$
DECLARE
    v_challenge_title TEXT;
    v_potential_reward DECIMAL(10, 2);
    v_inviter_username TEXT;
    v_push_token TEXT;
    v_notification_title TEXT;
    v_notification_body TEXT;
BEGIN
    -- Get challenge details
    SELECT c.title, c.potential_reward INTO v_challenge_title, v_potential_reward
    FROM public.challenges c
    WHERE c.id = NEW.challenge_id;

    -- Get inviter's username
    SELECT p.username INTO v_inviter_username
    FROM public.profiles p
    WHERE p.id = NEW.inviter_id;

    -- Get the user's active push token
    SELECT upt.push_token INTO v_push_token
    FROM public.user_push_tokens upt
    WHERE upt.user_id = NEW.invitee_id AND upt.is_active = TRUE
    ORDER BY upt.created_at DESC
    LIMIT 1;

    -- Only send push notification if push token exists
    IF v_push_token IS NOT NULL THEN
        v_notification_title := 'New Challenge Invitation';
        v_notification_body := COALESCE(v_inviter_username, 'Someone') || ' invited you to join "' || 
                               COALESCE(v_challenge_title, 'a challenge') || '"! Win up to $' || 
                               COALESCE(v_potential_reward::TEXT, '0') || '!';

        -- Insert into a push notification queue (or send directly via HTTP)
        -- For now, we'll create a record that can be processed by a cron job or Edge Function
        INSERT INTO public.push_notification_queue (user_id, push_token, title, body, data)
        VALUES (
            NEW.invitee_id,
            v_push_token,
            v_notification_title,
            v_notification_body,
            jsonb_build_object(
                'challenge_id', NEW.challenge_id,
                'invitation_id', NEW.id,
                'type', 'challenge_invitation'
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for sending push notification on new invitation
CREATE TRIGGER on_challenge_invitation_push_notification
    AFTER INSERT ON public.challenge_invitations
    FOR EACH ROW
    WHEN (NEW.status = 'pending')
    EXECUTE FUNCTION public.send_push_notification_on_invitation();

-- =====================================================
-- PUSH NOTIFICATION QUEUE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.push_notification_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    push_token TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}'::JSONB,
    status TEXT CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.push_notification_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can insert to push notification queue" ON public.push_notification_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view push notification queue" ON public.push_notification_queue FOR SELECT USING (true);
CREATE POLICY "Anyone can update push notification queue" ON public.push_notification_queue FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete from push notification queue" ON public.push_notification_queue FOR DELETE USING (true);

-- Index for processing queue
CREATE INDEX IF NOT EXISTS idx_push_notification_queue_status ON public.push_notification_queue(status) WHERE status = 'pending';

-- =====================================================
-- END OF PUSH TOKENS SCRIPT
-- =====================================================
