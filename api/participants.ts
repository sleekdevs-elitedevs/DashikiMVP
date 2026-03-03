// Participants API Service
// Handles all database operations for the challenge_participants table

import { supabase } from '../lib/supabase';

export interface Participant {
  id: string;
  challenge_id: string;
  user_id: string;
  status: 'joined' | 'completed' | 'dropped';
  joined_at: string;
  completed_at: string | null;
  // Stake-related fields
  stake_on_join?: number;
  is_winner?: boolean;
  payout_amount?: number;
  settled_at?: string | null;
}

export interface CreateParticipantInput {
  challenge_id: string;
  user_id: string;
  stake_on_join?: number;
}

export interface UpdateParticipantInput {
  status?: 'joined' | 'completed' | 'dropped';
  completed_at?: string;
  stake_on_join?: number;
}

export const participantsApi = {
  // Get all participants for a challenge
  async getByChallenge(challengeId: string): Promise<Participant[]> {
    const { data, error } = await supabase
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', challengeId)
      .order('joined_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get all challenges a user is participating in
  async getByUser(userId: string): Promise<Participant[]> {
    const { data, error } = await supabase
      .from('challenge_participants')
      .select('*')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get active participations for a user (joined or completed)
  async getActiveByUser(userId: string): Promise<Participant[]> {
    const { data, error } = await supabase
      .from('challenge_participants')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['joined', 'completed'])
      .order('joined_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get a single participant by ID
  async getById(id: string): Promise<Participant | null> {
    const { data, error } = await supabase
      .from('challenge_participants')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Check if a user is participating in a challenge
  async isParticipating(challengeId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('challenge_participants')
      .select('id')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .single();
    
    if (error && error.code === 'PGRST116') {
      return false;
    }
    if (error) throw error;
    return !!data;
  },

  // Get participant by challenge and user
  async getByChallengeAndUser(challengeId: string, userId: string): Promise<Participant | null> {
    const { data, error } = await supabase
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .single();
    
    if (error && error.code === 'PGRST116') {
      return null;
    }
    if (error) throw error;
    return data;
  },

  // Join a challenge with stake
  async join(challengeId: string, userId: string, stakeAmount?: number): Promise<Participant> {
    const { data, error } = await supabase
      .from('challenge_participants')
      .insert({
        challenge_id: challengeId,
        user_id: userId,
        status: 'joined',
        stake_on_join: stakeAmount || 1.00,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Leave a challenge (delete participation)
  async leave(challengeId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('challenge_participants')
      .delete()
      .eq('challenge_id', challengeId)
      .eq('user_id', userId);
    
    if (error) throw error;
  },

  // Update participant status
  async update(id: string, updates: UpdateParticipantInput): Promise<Participant> {
    const { data, error } = await supabase
      .from('challenge_participants')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Mark participant as completed
  async markCompleted(id: string): Promise<Participant> {
    return this.update(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    });
  },

  // Mark participant as dropped
  async markDropped(id: string): Promise<Participant> {
    return this.update(id, { status: 'dropped' });
  },

  // Get participants count for a challenge
  async getCountByChallenge(challengeId: string): Promise<number> {
    const { data, error } = await supabase
      .from('challenge_participants')
      .select('id', { count: 'exact' })
      .eq('challenge_id', challengeId)
      .eq('status', 'joined');
    
    if (error) throw error;
    return data?.length || 0;
  },

// Get completed participants for a challenge
  async getCompletedByChallenge(challengeId: string): Promise<Participant[]> {
    const { data, error } = await supabase
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get total stakes spent by a user (sum of all stake_on_join values)
  async getTotalStakesByUser(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('challenge_participants')
      .select('stake_on_join')
      .eq('user_id', userId);
    
    if (error) throw error;
    return data?.reduce((sum, p) => sum + (p.stake_on_join || 0), 0) || 0;
  },
};
