// Challenges API Service
// Handles all database operations for the challenges table

import { supabase } from '../lib/supabase';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: string;
  status: 'Active' | 'Upcoming' | 'Completed';
  entry_fee: number;
  potential_reward: number;
  participants_count: number;
  days_left: number;
  video_requirements: string | null;
  schedule_days: string[] | null;
  schedule_time: string | null;
  schedule_repeat: string | null;
  schedule_start_time: string | null;
  schedule_end_time: string | null;
  creator_id: string | null;
  created_at: string;
  updated_at: string;
  // Thumbnail image URL
  thumbnail_url: string | null;
  // Max random calls for verification
  max_random_calls: number | null;
  // Friends array - contains IDs of friends who joined this challenge
  friends: string[] | null;
  // Stake-related fields
  current_stake?: number;
  min_stake?: number;
  max_stake?: number;
  stake_multiplier?: number;
  total_pool?: number;
  winners_count?: number;
  losers_count?: number;
  settled_at?: string | null;
  settlement_status?: 'pending' | 'processing' | 'settled' | 'cancelled';
  completion_threshold?: number;
  // User participation fields (when fetching user's challenges)
  is_winner?: boolean;
  payout_amount?: number;
}

export interface CreateChallengeInput {
  title: string;
  description: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  category: string;
  status?: 'Active' | 'Upcoming' | 'Completed';
  entry_fee: number;
  potential_reward: number;
  video_requirements?: string;
  schedule_days?: string[];
  schedule_time?: string;
  schedule_repeat?: string;
  schedule_start_time?: string;
  schedule_end_time?: string;
  creator_id?: string;
  // Thumbnail image URL
  thumbnail_url?: string;
  // Max random calls for verification
  max_random_calls?: number;
  // Friends array - contains IDs of friends who can join this challenge
  friends?: string[];
  // Stake-related fields
  current_stake?: number;
  min_stake?: number;
  max_stake?: number;
  stake_multiplier?: number;
  completion_threshold?: number;
}

export const challengesApi = {
  // Get all challenges
  async getAll(): Promise<Challenge[]> {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get challenges by status
  async getByStatus(status: 'Active' | 'Upcoming' | 'Completed'): Promise<Challenge[]> {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get a single challenge by ID
  async getById(id: string): Promise<Challenge | null> {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Create a new challenge
  async create(challenge: CreateChallengeInput): Promise<Challenge> {
    const { data, error } = await supabase
      .from('challenges')
      .insert(challenge)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update a challenge
  async update(id: string, updates: Partial<CreateChallengeInput>): Promise<Challenge> {
    const { data, error } = await supabase
      .from('challenges')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Delete a challenge
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('challenges')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Get challenges by category
  async getByCategory(category: string): Promise<Challenge[]> {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('category', category)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get challenges by creator
  async getByCreator(creatorId: string): Promise<Challenge[]> {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Search challenges by title
  async search(query: string): Promise<Challenge[]> {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .ilike('title', `%${query}%`)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Add a friend to a challenge
  async addFriend(challengeId: string, friendId: string): Promise<Challenge> {
    // First get current friends array
    const { data: challenge, error: fetchError } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single();
    
    if (fetchError) throw fetchError;
    
    const currentFriends = challenge?.friends || [];
    if (!currentFriends.includes(friendId)) {
      const newFriends = [...currentFriends, friendId];
      
      const { data, error } = await supabase
        .from('challenges')
        .update({ 
          friends: newFriends,
          updated_at: new Date().toISOString()
        })
        .eq('id', challengeId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
    
    return challenge;
  },

  // Remove a friend from a challenge
  async removeFriend(challengeId: string, friendId: string): Promise<Challenge> {
    // First get current friends array
    const { data: challenge, error: fetchError } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single();
    
    if (fetchError) throw fetchError;
    
    const currentFriends = challenge?.friends || [];
    const newFriends = currentFriends.filter((id: string) => id !== friendId);
    
    const { data, error } = await supabase
      .from('challenges')
      .update({ 
        friends: newFriends,
        updated_at: new Date().toISOString()
      })
      .eq('id', challengeId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get past/settled challenges (completed challenges)
  async getPastChallenges(): Promise<Challenge[]> {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .in('settlement_status', ['settled', 'cancelled'])
      .order('settled_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get user's past challenge participation (challenges they've participated in that are settled)
  async getPastChallengesByUser(userId: string): Promise<Challenge[]> {
    // First get participant records for this user
    const { data: participants, error: participantError } = await supabase
      .from('challenge_participants')
      .select('challenge_id, is_winner, payout_amount, settled_at')
      .eq('user_id', userId);
    
    if (participantError) throw participantError;
    
    if (!participants || participants.length === 0) {
      return [];
    }
    
    const challengeIds = participants.map(p => p.challenge_id);
    
    // Then get the challenges
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .in('id', challengeIds)
      .in('settlement_status', ['settled', 'cancelled'])
      .order('settled_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Manually trigger settlement for a challenge (calls database function)
  async triggerSettlement(challengeId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('trigger_settlement', {
      p_challenge_id: challengeId
    });
    
    if (error) {
      console.error('Error triggering settlement:', error);
      throw error;
    }
    
    return data;
  },

  // Get challenges where friends have joined (friends' challenges)
  // This takes the userId and the list of friendIds to find challenges 
  // that friends have participated in
  async getByFriends(userId: string, friendIds: string[]): Promise<Challenge[]> {
    try {
      if (!friendIds || friendIds.length === 0) {
        return [];
      }
      
      // Get challenges where any of the friends have participated
      const { data: participants, error: participantsError } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .in('user_id', friendIds);
      
      if (participantsError) {
        console.error('Error fetching participant challenges:', participantsError);
        return [];
      }
      
      if (!participants || participants.length === 0) {
        return [];
      }
      
      // Get unique challenge IDs
      const challengeIds = [...new Set(participants.map(p => p.challenge_id))];
      
      // Get the challenges
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .in('id', challengeIds)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error in getByFriends:', error);
      return [];
    }
  },
};
