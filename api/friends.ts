// Friends API Service
// Handles all database operations for the friends table

import { supabase } from '../lib/supabase';
import { notificationsApi } from './notifications';
import { profilesApi } from './profiles';

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface FriendWithProfile extends Friend {
  friend_profile?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

export interface CreateFriendRequestInput {
  user_id: string;
  friend_id: string;
}

export const friendsApi = {
  // Get all friends (accepted) for a user
  async getFriends(userId: string): Promise<FriendWithProfile[]> {
    const { data, error } = await supabase
      .from('friends')
      .select(`
        *,
        friend_profile:profiles!friends_friend_id_fkey(id, username, avatar_url)
      `)
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Filter out the current user from the results
    // This handles the case where friend_id = current user (someone sent them a request)
    // and the query returns their own profile as friend_profile
    const friends = (data || []).filter(friend => {
      // Get the profile that was fetched (friend_profile)
      const profileId = friend.friend_profile?.id;
      // Exclude if the profile belongs to the current user
      return profileId !== userId;
    });
    
    return friends;
  },

  // Get pending friend requests for a user
  async getPendingRequests(userId: string): Promise<FriendWithProfile[]> {
    const { data, error } = await supabase
      .from('friends')
      .select(`
        *,
        friend_profile:profiles!friends_friend_id_fkey(id, username, avatar_url),
        user_profile:profiles!friends_user_id_fkey(id, username, avatar_url)
      `)
      .eq('friend_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get sent friend requests
  async getSentRequests(userId: string): Promise<FriendWithProfile[]> {
    const { data, error } = await supabase
      .from('friends')
      .select(`
        *,
        friend_profile:profiles!friends_friend_id_fkey(id, username, avatar_url)
      `)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Send a friend request
  async sendRequest(request: CreateFriendRequestInput): Promise<Friend> {
    const { data, error } = await supabase
      .from('friends')
      .insert({
        user_id: request.user_id,
        friend_id: request.friend_id,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Send notification to the recipient
    try {
      const senderProfile = await profilesApi.getById(request.user_id);
      if (senderProfile) {
        await notificationsApi.create({
          user_id: request.friend_id,
          title: 'New Friend Request',
          message: `${senderProfile.username} sent you a friend request`,
          type: 'info',
        });
      }
    } catch (notificationError) {
      // Log error but don't fail the friend request
      console.error('Error sending friend request notification:', notificationError);
    }

    return data;
  },

  // Accept a friend request
  async acceptRequest(friendId: string, userId: string): Promise<Friend> {
    // First get the friend record to find who sent the request
    const { data: friendRecord, error: fetchError } = await supabase
      .from('friends')
      .select('user_id, friend_id')
      .eq('id', friendId)
      .single();

    if (fetchError) throw fetchError;

    const { data, error } = await supabase
      .from('friends')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendId)
      .eq('friend_id', userId)
      .select()
      .single();

    if (error) throw error;

    // Send notification to the request sender
    try {
      const acceptorProfile = await profilesApi.getById(userId);
      if (acceptorProfile) {
        await notificationsApi.create({
          user_id: friendRecord.user_id,
          title: 'Friend Request Accepted',
          message: `${acceptorProfile.username} accepted your friend request`,
          type: 'info',
        });
      }
    } catch (notificationError) {
      console.error('Error sending acceptance notification:', notificationError);
    }

    return data;
  },

  // Reject a friend request
  async rejectRequest(friendId: string, userId: string): Promise<Friend> {
    // First get the friend record to find who sent the request
    const { data: friendRecord, error: fetchError } = await supabase
      .from('friends')
      .select('user_id, friend_id')
      .eq('id', friendId)
      .single();

    if (fetchError) throw fetchError;

    const { data, error } = await supabase
      .from('friends')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', friendId)
      .eq('friend_id', userId)
      .select()
      .single();

    if (error) throw error;

    // Send notification to the request sender
    try {
      const rejectorProfile = await profilesApi.getById(userId);
      if (rejectorProfile) {
        await notificationsApi.create({
          user_id: friendRecord.user_id,
          title: 'Friend Request Declined',
          message: `${rejectorProfile.username} declined your friend request`,
          type: 'info',
        });
      }
    } catch (notificationError) {
      console.error('Error sending rejection notification:', notificationError);
    }

    return data;
  },

  // Remove a friend
  async removeFriend(friendId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('friends')
      .delete()
      .eq('id', friendId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  // Check if users are friends
  async areFriends(userId: string, otherUserId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('friends')
      .select('id')
      .or(`and(user_id.eq.${userId},friend_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},friend_id.eq.${userId})`)
      .eq('status', 'accepted')
      .single();

    if (error && error.code === 'PGRST116') {
      return false;
    }
    if (error) throw error;
    return !!data;
  },

  // Check pending request status
  async getPendingStatus(userId: string, otherUserId: string): Promise<'none' | 'pending_sent' | 'pending_received'> {
    // Check if user sent a request
    const { data: sentData, error: sentError } = await supabase
      .from('friends')
      .select('id')
      .eq('user_id', userId)
      .eq('friend_id', otherUserId)
      .eq('status', 'pending')
      .single();

    if (!sentError && sentData) {
      return 'pending_sent';
    }

    // Check if user received a request
    const { data: receivedData, error: receivedError } = await supabase
      .from('friends')
      .select('id')
      .eq('friend_id', userId)
      .eq('user_id', otherUserId)
      .eq('status', 'pending')
      .single();

    if (!receivedError && receivedData) {
      return 'pending_received';
    }

    return 'none';
  },
};
