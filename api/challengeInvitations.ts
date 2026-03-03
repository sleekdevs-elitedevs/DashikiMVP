// Challenge Invitations API Service
// Handles all database operations for the challenge_invitations table

import { supabase } from '../lib/supabase';

export interface ChallengeInvitation {
  id: string;
  challenge_id: string;
  inviter_id: string;
  invitee_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChallengeInvitationWithDetails extends ChallengeInvitation {
  challenge?: {
    id: string;
    title: string;
    description: string;
    category: string;
    entry_fee: number;
    potential_reward: number;
    status: string;
  };
  inviter_profile?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  invitee_profile?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

export interface CreateChallengeInvitationInput {
  challenge_id: string;
  inviter_id: string;
  invitee_id: string;
  message?: string;
}

export const challengeInvitationsApi = {
  // Get all pending invitations received by a user
  async getReceivedInvitations(userId: string): Promise<ChallengeInvitationWithDetails[]> {
    const { data, error } = await supabase
      .from('challenge_invitations')
      .select(`
        *,
        challenge:challenges(id, title, description, category, entry_fee, potential_reward, status),
        inviter_profile:profiles!challenge_invitations_inviter_id_fkey(id, username, avatar_url)
      `)
      .eq('invitee_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get all invitations sent by a user
  async getSentInvitations(userId: string): Promise<ChallengeInvitationWithDetails[]> {
    const { data, error } = await supabase
      .from('challenge_invitations')
      .select(`
        *,
        challenge:challenges(id, title, description, category, entry_fee, potential_reward, status),
        invitee_profile:profiles!challenge_invitations_invitee_id_fkey(id, username, avatar_url)
      `)
      .eq('inviter_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get all invitations for a specific challenge
  async getByChallenge(challengeId: string): Promise<ChallengeInvitationWithDetails[]> {
    const { data, error } = await supabase
      .from('challenge_invitations')
      .select(`
        *,
        inviter_profile:profiles!challenge_invitations_inviter_id_fkey(id, username, avatar_url),
        invitee_profile:profiles!challenge_invitations_invitee_id_fkey(id, username, avatar_url)
      `)
      .eq('challenge_id', challengeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get a single invitation by ID
  async getById(id: string): Promise<ChallengeInvitationWithDetails | null> {
    const { data, error } = await supabase
      .from('challenge_invitations')
      .select(`
        *,
        challenge:challenges(id, title, description, category, entry_fee, potential_reward, status),
        inviter_profile:profiles!challenge_invitations_inviter_id_fkey(id, username, avatar_url),
        invitee_profile:profiles!challenge_invitations_invitee_id_fkey(id, username, avatar_url)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Send a challenge invitation
  async sendInvitation(invitation: CreateChallengeInvitationInput): Promise<ChallengeInvitation> {
    const { data, error } = await supabase
      .from('challenge_invitations')
      .insert({
        challenge_id: invitation.challenge_id,
        inviter_id: invitation.inviter_id,
        invitee_id: invitation.invitee_id,
        message: invitation.message || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Send invitations to multiple friends at once
  async sendBulkInvitations(
    challengeId: string,
    inviterId: string,
    inviteeIds: string[],
    message?: string
  ): Promise<ChallengeInvitation[]> {
    const invitations = inviteeIds.map((invitee_id) => ({
      challenge_id: challengeId,
      inviter_id: inviterId,
      invitee_id,
      message: message || null,
      status: 'pending',
    }));

    const { data, error } = await supabase
      .from('challenge_invitations')
      .insert(invitations)
      .select();

    if (error) throw error;
    return data || [];
  },

  // Accept an invitation
  async acceptInvitation(invitationId: string, userId: string): Promise<ChallengeInvitation> {
    const { data, error } = await supabase
      .from('challenge_invitations')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', invitationId)
      .eq('invitee_id', userId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Reject an invitation
  async rejectInvitation(invitationId: string, userId: string): Promise<ChallengeInvitation> {
    const { data, error } = await supabase
      .from('challenge_invitations')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', invitationId)
      .eq('invitee_id', userId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Cancel an invitation (by the inviter)
  async cancelInvitation(invitationId: string, userId: string): Promise<ChallengeInvitation> {
    const { data, error } = await supabase
      .from('challenge_invitations')
      .delete()
      .eq('id', invitationId)
      .eq('inviter_id', userId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Check if an invitation already exists
  async checkExistingInvitation(
    challengeId: string,
    inviterId: string,
    inviteeId: string
  ): Promise<ChallengeInvitation | null> {
    const { data, error } = await supabase
      .from('challenge_invitations')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('inviter_id', inviterId)
      .eq('invitee_id', inviteeId)
      .in('status', ['pending', 'accepted'])
      .single();

    if (error && error.code === 'PGRST116') {
      return null;
    }
    if (error) throw error;
    return data;
  },

  // Get invitations count for a user (for badge display)
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('challenge_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('invitee_id', userId)
      .eq('status', 'pending');

    if (error) throw error;
    return count || 0;
  },

  // Get friends who have already been invited to a challenge
  async getInvitedFriendIds(challengeId: string, inviterId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('challenge_invitations')
      .select('invitee_id')
      .eq('challenge_id', challengeId)
      .eq('inviter_id', inviterId)
      .in('status', ['pending', 'accepted']);

    if (error) throw error;
    return data?.map((item) => item.invitee_id) || [];
  },
};
