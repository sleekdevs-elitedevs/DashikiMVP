-- =====================================================
-- Dashiki Seed Data
-- This script populates the database with sample data for testing
-- =====================================================

-- Note: Run this after 01_tables.sql
-- Update the profile IDs and user IDs with actual user IDs from your auth.users table

-- =====================================================
-- SAMPLE PROFILES (Replace UUIDs with actual auth.user IDs)
-- =====================================================
-- These are placeholder UUIDs - in production, these would come from actual user registrations

-- Insert sample profiles (using a demo user for testing)
-- INSERT INTO public.profiles (id, username, avatar_url, bio)
-- VALUES 
--     ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'fitqueen', 'https://i.pravatar.cc/150?img=1', 'Fitness enthusiast loving the challenge life!'),
--     ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'zenmaster', 'https://i.pravatar.cc/150?img=2', 'Mindfulness practitioner'),
--     ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'waterboy', 'https://i.pravatar.cc/150?img=3', 'Staying hydrated!')
-- ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SAMPLE CHALLENGES
-- =====================================================
INSERT INTO public.challenges (title, description, difficulty, category, status, entry_fee, potential_reward, participants_count, days_left, video_requirements, schedule_days, schedule_time, schedule_repeat, schedule_start_time, schedule_end_time)
VALUES 
    (
        '30-Day Fitness Challenge',
        'Complete 30 minutes of exercise for every day for 30 days',
        'Hard',
        'Fitness',
        'Active',
        25.00,
        350.00,
        1247,
        15,
        'Record yourself completing each workout session. Videos must show your face and the activity.',
        ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        '07:00',
        'daily',
        '07:00',
        '07:30'
    ),
    (
        'Mindfulness Journey',
        'Practice meditation for 10 minutes daily',
        'Medium',
        'Wellness',
        'Active',
        15.00,
        180.00,
        842,
        22,
        'Record a short video of your meditation session showing your peaceful state.',
        ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        '06:00',
        'daily',
        '06:00',
        '06:10'
    ),
    (
        'Hydration Hero',
        'Drink 8 glasses of water every day',
        'Easy',
        'Wellness',
        'Active',
        10.00,
        120.00,
        2103,
        10,
        'Take a photo of your water intake tracking app or log showing each glass.',
        ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        '09:00',
        'daily',
        '09:00',
        '21:00'
    ),
    (
        'Zero Waste Week',
        'Reduce your waste to zero for one week',
        'Medium',
        'Sustainability',
        'Completed',
        20.00,
        280.00,
        567,
        0,
        'Document your weekly waste with photos showing bin contents or lack thereof.',
        ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        '20:00',
        'weekly',
        '20:00',
        '21:00'
    ),
    (
        'Learn a New Language',
        'Spend 15 minutes daily learning a new language',
        'Easy',
        'Education',
        'Upcoming',
        12.00,
        156.00,
        1893,
        30,
        'Record yourself speaking or practicing vocabulary from your language learning app.',
        ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        '19:00',
        'daily',
        '19:00',
        '19:15'
    ),
    (
        'Daily Reading Challenge',
        'Read for at least 20 minutes every day',
        'Easy',
        'Education',
        'Active',
        8.00,
        96.00,
        945,
        5,
        'Record a short video showing the book you are reading and your reading spot.',
        ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        '21:00',
        'daily',
        '21:00',
        '21:20'
    ),
    (
        'Morning Yoga Streak',
        'Practice yoga every morning for 21 days',
        'Medium',
        'Wellness',
        'Completed',
        18.00,
        234.00,
        756,
        0,
        'Record your yoga session showing your mat and full body during practice.',
        ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        '06:00',
        'daily',
        '06:00',
        '06:45'
    ),
    (
        '5K Running Challenge',
        'Run 5km every day for a week',
        'Hard',
        'Fitness',
        'Active',
        30.00,
        420.00,
        1234,
        14,
        'Record your run with GPS watch visible or use a running app that tracks your route.',
        ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        '06:00',
        'weekly',
        '06:00',
        '07:00'
    ),
    (
        'Vegetarian Week',
        'Eat only vegetarian for 7 days',
        'Medium',
        'Sustainability',
        'Upcoming',
        16.00,
        208.00,
        432,
        21,
        'Take photos of your meals showing only vegetarian ingredients.',
        ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        '12:00',
        'weekly',
        '12:00',
        '12:00'
    )
ON CONFLICT DO NOTHING;

-- =====================================================
-- SAMPLE NOTIFICATIONS
-- =====================================================
-- INSERT INTO public.notifications (user_id, title, message, type)
-- VALUES 
--     ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Welcome to Dashiki!', 'Start your first challenge today and win rewards!', 'info'),
--     ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Challenge Starting Soon', 'The 30-Day Fitness Challenge starts in 2 days!', 'challenge'),
--     ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Reward Earned!', 'You earned $50 for completing your challenge!', 'reward')
-- ON CONFLICT DO NOTHING;

-- =====================================================
-- END OF SEED DATA SCRIPT
-- =====================================================
