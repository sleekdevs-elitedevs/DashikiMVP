// Verification Calls API Service
// Handles all database operations for random verification calls

import { supabase } from '../lib/supabase';

export interface ScheduledVerificationCall {
  id: string;
  challenge_id: string;
  scheduled_time: string;
  status: 'pending' | 'sent' | 'accepted' | 'completed' | 'failed' | 'cancelled';
  call_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerificationCallParticipant {
  id: string;
  scheduled_call_id: string;
  participant_id: string;
  user_id: string;
  selection_order: number;
  max_calls_allowed: number;
  calls_completed: number;
  status: 'selected' | 'notified' | 'responded' | 'completed' | 'declined' | 'no_response';
  last_call_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerificationCallProof {
  id: string;
  scheduled_call_id: string;
  participant_id: string;
  call_duration: number | null;
  call_recording_url: string | null;
  participant_responded: boolean;
  submitted_at: string;
}

export const verificationCallsApi = {
  // Schedule verification calls for a challenge
  async scheduleCalls(challengeId: string): Promise<number> {
    const { data, error } = await supabase.rpc('schedule_verification_calls', {
      p_challenge_id: challengeId
    });
    
    if (error) {
      console.error('Error scheduling verification calls:', error);
      throw error;
    }
    
    return data || 0;
  },

  // Get scheduled calls for a challenge
  async getByChallenge(challengeId: string): Promise<ScheduledVerificationCall[]> {
    const { data, error } = await supabase
      .from('scheduled_verification_calls')
      .select('*')
      .eq('challenge_id', challengeId)
      .order('scheduled_time', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  // Get pending call for user
  async getPendingForUser(userId: string): Promise<ScheduledVerificationCall | null> {
    const { data, error } = await supabase
      .from('scheduled_verification_calls')
      .select('*')
      .eq('status', 'sent')
      .order('scheduled_time', { ascending: true })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (data) {
      // Check if user is the selected participant
      const { data: participant } = await supabase
        .from('verification_call_participants')
        .select('*')
        .eq('scheduled_call_id', data.id)
        .eq('user_id', userId)
        .eq('status', 'notified')
        .single();
      
      if (participant) {
        return data;
      }
    }
    
    return null;
  },

  // Get call details
  async getCallDetails(callId: string): Promise<ScheduledVerificationCall | null> {
    const { data, error } = await supabase
      .from('scheduled_verification_calls')
      .select('*')
      .eq('id', callId)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Accept/join a verification call
  async acceptCall(callId: string, userId: string): Promise<void> {
    // First get current calls_completed count
    const { data: participant } = await supabase
      .from('verification_call_participants')
      .select('calls_completed')
      .eq('scheduled_call_id', callId)
      .eq('user_id', userId)
      .single();
    
    const newCallsCompleted = (participant?.calls_completed || 0) + 1;
    
    // Update call status
    const { error: callError } = await supabase
      .from('scheduled_verification_calls')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', callId);
    
    if (callError) throw callError;

    // Update participant status
    const { error: participantError } = await supabase
      .from('verification_call_participants')
      .update({ 
        status: 'responded', 
        last_call_at: new Date().toISOString(),
        calls_completed: newCallsCompleted,
        updated_at: new Date().toISOString()
      })
      .eq('scheduled_call_id', callId)
      .eq('user_id', userId);
    
    if (participantError) throw participantError;
  },

  // Complete a verification call with proof
  async completeCall(
    callId: string, 
    userId: string, 
    participantId: string,
    callDuration: number,
    recordingUrl?: string
  ): Promise<void> {
    // Update call status
    const { error: callError } = await supabase
      .from('scheduled_verification_calls')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', callId);
    
    if (callError) throw callError;

    // Update participant status
    const { error: participantError } = await supabase
      .from('verification_call_participants')
      .update({ 
        status: 'completed', 
        updated_at: new Date().toISOString()
      })
      .eq('scheduled_call_id', callId)
      .eq('user_id', userId);
    
    if (participantError) throw participantError;

    // Insert call proof
    const { error: proofError } = await supabase
      .from('verification_call_proofs')
      .insert({
        scheduled_call_id: callId,
        participant_id: participantId,
        call_duration: callDuration,
        call_recording_url: recordingUrl || null,
        participant_responded: true,
        submitted_at: new Date().toISOString()
      });
    
    if (proofError) throw proofError;
  },

  // Mark call as failed (no response)
  async markCallFailed(callId: string): Promise<void> {
    // Update call status
    const { error: callError } = await supabase
      .from('scheduled_verification_calls')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', callId);
    
    if (callError) throw callError;

    // Update participant status
    const { error: participantError } = await supabase
      .from('verification_call_participants')
      .update({ 
        status: 'no_response', 
        updated_at: new Date().toISOString()
      })
      .eq('scheduled_call_id', callId);
    
    if (participantError) throw participantError;
  },

  // Get user's call history
  async getUserHistory(userId: string): Promise<VerificationCallProof[]> {
    const { data, error } = await supabase
      .from('verification_call_proofs')
      .select('*')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Process pending calls (for cron job simulation)
  async processPendingCalls(): Promise<number> {
    const { data, error } = await supabase.rpc('process_verification_calls');
    
    if (error) {
      console.error('Error processing verification calls:', error);
      throw error;
    }
    
    return data || 0;
  },

  // Get call proof for a participant
  async getProofForParticipant(participantId: string): Promise<VerificationCallProof | null> {
    const { data, error } = await supabase
      .from('verification_call_proofs')
      .select('*')
      .eq('participant_id', participantId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },
};
