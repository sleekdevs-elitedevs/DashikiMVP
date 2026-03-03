// Verification Call Notifications Service
// Handles sending push notifications for scheduled verification calls

import { supabase } from './supabase';
import { getPushTokensForUsers, sendPushNotification, sendLocalNotification } from './notifications';

/**
 * Send notification to a participant about an upcoming verification call
 */
export async function notifyParticipantOfVerificationCall(
  userId: string,
  challengeId: string,
  challengeTitle: string,
  scheduledTime: Date
): Promise<void> {
  try {
    // Get user's push token
    const tokens = await getPushTokensForUsers([userId]);
    
    const title = '📹 Verification Call Required';
    const body = `You're selected for a random verification call for "${challengeTitle}". Join now to verify your challenge completion!`;
    const data = {
      type: 'verification_call',
      challenge_id: challengeId,
      scheduled_time: scheduledTime.toISOString(),
    };
    
    // Send push notification if token available
    if (tokens.length > 0) {
      await sendPushNotification(tokens[0], title, body, data);
    } else {
      // Fallback to local notification
      await sendLocalNotification(title, body, data);
    }
    
    console.log(`Verification call notification sent to user ${userId}`);
  } catch (error) {
    console.error('Error sending verification call notification:', error);
  }
}

/**
 * Batch notify multiple participants
 */
export async function notifyParticipantsOfVerificationCalls(
  userIds: string[],
  challengeId: string,
  challengeTitle: string,
  scheduledTime: Date
): Promise<void> {
  if (userIds.length === 0) return;
  
  try {
    // Get all push tokens
    const tokens = await getPushTokensForUsers(userIds);
    
    const title = '📹 Verification Call Required';
    const body = `You're selected for a random verification call for "${challengeTitle}". Join now to verify!`;
    const data = {
      type: 'verification_call',
      challenge_id: challengeId,
      scheduled_time: scheduledTime.toISOString(),
    };
    
    // Send to all tokens
    const promises = tokens.map(token => sendPushNotification(token, title, body, data));
    await Promise.allSettled(promises);
    
    console.log(`Verification call notifications sent to ${userIds.length} participants`);
  } catch (error) {
    console.error('Error sending batch verification call notifications:', error);
  }
}

/**
 * Send reminder notification before verification call
 */
export async function sendVerificationCallReminder(
  userId: string,
  challengeTitle: string,
  minutesUntilCall: number
): Promise<void> {
  try {
    const tokens = await getPushTokensForUsers([userId]);
    
    const title = '⏰ Verification Call Starting Soon';
    const body = minutesUntilCall > 0 
      ? `Your verification call for "${challengeTitle}" starts in ${minutesUntilCall} minutes!`
      : `Your verification call for "${challengeTitle}" is starting now!`;
    const data = {
      type: 'verification_call_reminder',
    };
    
    if (tokens.length > 0) {
      await sendPushNotification(tokens[0], title, body, data);
    } else {
      await sendLocalNotification(title, body, data);
    }
  } catch (error) {
    console.error('Error sending verification call reminder:', error);
  }
}

/**
 * Process scheduled calls and send notifications
 * This should be called by a cron job or periodically
 */
export async function processScheduledCallNotifications(): Promise<number> {
  try {
    // Get calls that need to be notified (status = 'pending' and scheduled_time is now)
    const { data: pendingCalls, error } = await supabase
      .from('scheduled_verification_calls')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_time', new Date().toISOString())
      .limit(10);
    
    if (error) {
      console.error('Error fetching pending calls:', error);
      return 0;
    }
    
    let processedCount = 0;
    
    for (const call of pendingCalls || []) {
      // Get the selected participant
      const { data: participant } = await supabase
        .from('verification_call_participants')
        .select('user_id, user_id')
        .eq('scheduled_call_id', call.id)
        .single();
      
      if (participant) {
        // Get challenge title
        const { data: challenge } = await supabase
          .from('challenges')
          .select('title')
          .eq('id', call.challenge_id)
          .single();
        
        // Send notification
        await notifyParticipantOfVerificationCall(
          participant.user_id,
          call.challenge_id,
          challenge?.title || 'Challenge',
          new Date(call.scheduled_time)
        );
        
        // Update call status to 'sent'
        await supabase
          .from('scheduled_verification_calls')
          .update({ status: 'sent', updated_at: new Date().toISOString() })
          .eq('id', call.id);
        
        // Update participant status
        await supabase
          .from('verification_call_participants')
          .update({ status: 'notified', updated_at: new Date().toISOString() })
          .eq('scheduled_call_id', call.id)
          .eq('user_id', participant.user_id);
        
        processedCount++;
      }
    }
    
    return processedCount;
  } catch (error) {
    console.error('Error processing scheduled call notifications:', error);
    return 0;
  }
}
