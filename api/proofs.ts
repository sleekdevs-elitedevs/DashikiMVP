// Proofs API Service
// Handles all database operations for the challenge_proofs table

import { supabase } from '../lib/supabase';

export interface Proof {
  id: string;
  user_id: string;
  challenge_id: string;
  participant_id: string;
  file_url: string;
  file_type: 'video' | 'image';
  description: string | null;
  approved: boolean;
  uploaded_at: string;
}

export interface CreateProofInput {
  user_id: string;
  challenge_id: string;
  participant_id: string;
  file_url: string;
  file_type: 'video' | 'image';
  description?: string;
}

export interface UpdateProofInput {
  file_url?: string;
  description?: string;
  approved?: boolean;
}

export const proofsApi = {
  // Get all proofs for a challenge
  async getByChallenge(challengeId: string): Promise<Proof[]> {
    const { data, error } = await supabase
      .from('challenge_proofs')
      .select('*')
      .eq('challenge_id', challengeId)
      .order('uploaded_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get all proofs for a user
  async getByUser(userId: string): Promise<Proof[]> {
    const { data, error } = await supabase
      .from('challenge_proofs')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get proofs by participant
  async getByParticipant(participantId: string): Promise<Proof[]> {
    const { data, error } = await supabase
      .from('challenge_proofs')
      .select('*')
      .eq('participant_id', participantId)
      .order('uploaded_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get a single proof by ID
  async getById(id: string): Promise<Proof | null> {
    const { data, error } = await supabase
      .from('challenge_proofs')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get approved proofs for a challenge
  async getApprovedByChallenge(challengeId: string): Promise<Proof[]> {
    const { data, error } = await supabase
      .from('challenge_proofs')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('approved', true)
      .order('uploaded_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get pending proofs for a challenge (not approved yet)
  async getPendingByChallenge(challengeId: string): Promise<Proof[]> {
    const { data, error } = await supabase
      .from('challenge_proofs')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('approved', false)
      .order('uploaded_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get proofs by file type
  async getByFileType(challengeId: string, fileType: 'video' | 'image'): Promise<Proof[]> {
    const { data, error } = await supabase
      .from('challenge_proofs')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('file_type', fileType)
      .order('uploaded_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Create a new proof
  async create(proof: CreateProofInput): Promise<Proof> {
    const { data, error } = await supabase
      .from('challenge_proofs')
      .insert(proof)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update a proof
  async update(id: string, updates: UpdateProofInput): Promise<Proof> {
    const { data, error } = await supabase
      .from('challenge_proofs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Approve a proof
  async approve(id: string): Promise<Proof> {
    return this.update(id, { approved: true });
  },

  // Reject a proof (update description or delete)
  async reject(id: string): Promise<Proof> {
    return this.update(id, { approved: false });
  },

  // Delete a proof
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('challenge_proofs')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Get proof count for a challenge
  async getCountByChallenge(challengeId: string): Promise<number> {
    const { data, error } = await supabase
      .from('challenge_proofs')
      .select('id', { count: 'exact' })
      .eq('challenge_id', challengeId);
    
    if (error) throw error;
    return data?.length || 0;
  },

  // Get approved proof count for a challenge
  async getApprovedCountByChallenge(challengeId: string): Promise<number> {
    const { data, error } = await supabase
      .from('challenge_proofs')
      .select('id', { count: 'exact' })
      .eq('challenge_id', challengeId)
      .eq('approved', true);
    
    if (error) throw error;
    return data?.length || 0;
  },
};
