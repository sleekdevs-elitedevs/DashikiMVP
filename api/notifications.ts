// Notifications API Service
// Handles all database operations for the notifications table

import { supabase } from '../lib/supabase';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'reward' | 'challenge' | 'system';
  read: boolean;
  created_at: string;
  // New metadata fields for challenge invitations
  source_user_id?: string;
  challenge_id?: string;
  potential_reward?: number;
  challenge_title?: string;
}

export interface CreateNotificationInput {
  user_id: string;
  title: string;
  message: string;
  type?: 'info' | 'reward' | 'challenge' | 'system';
}

export interface UpdateNotificationInput {
  title?: string;
  message?: string;
  type?: 'info' | 'reward' | 'challenge' | 'system';
  read?: boolean;
}

export const notificationsApi = {
  // Get all notifications for a user
  async getByUser(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get a single notification by ID
  async getById(id: string): Promise<Notification | null> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get unread notifications for a user
  async getUnread(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get notifications by type
  async getByType(userId: string, type: 'info' | 'reward' | 'challenge' | 'system'): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get recent notifications (limited)
  async getRecent(userId: string, limit: number = 10): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  },

  // Create a new notification
  async create(notification: CreateNotificationInput): Promise<Notification> {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notification)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update a notification
  async update(id: string, updates: UpdateNotificationInput): Promise<Notification> {
    const { data, error } = await supabase
      .from('notifications')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Mark a notification as read
  async markAsRead(id: string): Promise<Notification> {
    return this.update(id, { read: true });
  },

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    
    if (error) throw error;
  },

  // Delete a notification
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Delete all read notifications for a user
  async deleteRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
      .eq('read', true);
    
    if (error) throw error;
  },

  // Get unread count for a user
  async getUnreadCount(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('read', false);
    
    if (error) throw error;
    return data?.length || 0;
  },
};
