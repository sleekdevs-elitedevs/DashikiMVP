// Profiles API Service
// Handles all database operations for the profiles table

import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProfileInput {
  id: string;
  username: string;
  avatar_url?: string;
  bio?: string;
}

export interface UpdateProfileInput {
  username?: string;
  avatar_url?: string;
  bio?: string;
}

export const profilesApi = {
  // Get all profiles (publicly visible)
  async getAll(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get a single profile by ID
  async getById(id: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get a profile by username
  async getByUsername(username: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get multiple profiles by IDs
  async getByIds(ids: string[]): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('id', ids);
    
    if (error) throw error;
    return data || [];
  },

  // Create a new profile
  async create(profile: CreateProfileInput): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .insert(profile)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update a profile
  async update(id: string, updates: UpdateProfileInput): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Delete a profile (usually handled by RLS/cascade)
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Check if username is available
  async isUsernameAvailable(username: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // PGRST116 is "No rows returned" which means username is available
      return true;
    }
    if (error) throw error;
    return !data;
  },

  // Search profiles by username
  async searchByUsername(searchTerm: string): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${searchTerm}%`)
      .order('username');
    
    if (error) throw error;
    return data || [];
  },
};
