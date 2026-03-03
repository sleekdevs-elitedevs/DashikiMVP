-- =====================================================
-- FRIENDS TABLE
-- This script creates the friends table for user connections
-- =====================================================

-- =====================================================
-- FRIENDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.friends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    friend_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

-- Enable RLS
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- RLS Policies for friends
CREATE POLICY "Users can view their friends" ON public.friends FOR SELECT 
    USING (user_id = auth.uid() OR friend_id = auth.uid());

CREATE POLICY "Users can send friend requests" ON public.friends FOR INSERT 
    WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can update friend requests" ON public.friends FOR UPDATE 
    USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete friends" ON public.friends FOR DELETE 
    USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_friends_user ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON public.friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON public.friends(status);

-- =====================================================
-- END OF FRIENDS TABLE SCRIPT
-- =====================================================
