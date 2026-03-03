// Verification Calls Hook
// Handles checking for pending verification calls and managing call flow

import { useState, useEffect, useCallback } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { verificationCallsApi, ScheduledVerificationCall } from '../api/verificationCalls';

export function useVerificationCalls() {
  const router = useRouter();
  const [pendingCall, setPendingCall] = useState<ScheduledVerificationCall | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Check for pending calls on mount and app state change
  const checkForPendingCalls = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;
      
      // Check for pending call for this user
      const call = await verificationCallsApi.getPendingForUser(user.id);
      
      if (call) {
        setPendingCall(call);
        
        // Show alert to user
        Alert.alert(
          '📹 Verification Call',
          'You have a pending verification call for a challenge. Would you like to join now?',
          [
            {
              text: 'Join Now',
              onPress: () => router.push(`/challenge/verify/${call.id}`),
            },
            {
              text: 'Later',
              onPress: () => {},
              style: 'cancel',
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error checking for pending calls:', error);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Handle incoming call notification
  const handleIncomingCall = useCallback(async (callId: string) => {
    try {
      // Get call details
      const call = await verificationCallsApi.getCallDetails(callId);
      
      if (call && call.status === 'sent') {
        setPendingCall(call);
        
        // Navigate to verification screen
        router.push(`/challenge/verify/${callId}`);
      }
    } catch (error) {
      console.error('Error handling incoming call:', error);
    }
  }, [router]);

  // Accept and join call
  const acceptCall = useCallback(async (callId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;
      
      await verificationCallsApi.acceptCall(callId, user.id);
      
      // Navigate to call screen
      router.push(`/challenge/call/${callId}`);
    } catch (error) {
      console.error('Error accepting call:', error);
      Alert.alert('Error', 'Failed to join the call. Please try again.');
    }
  }, [router]);

  // Complete call with proof
  const completeCall = useCallback(async (
    callId: string, 
    participantId: string,
    duration: number,
    recordingUrl?: string
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;
      
      await verificationCallsApi.completeCall(callId, user.id, participantId, duration, recordingUrl);
      
      setPendingCall(null);
      
      Alert.alert(
        '✅ Verification Complete',
        'Your verification call has been recorded. Thank you for participating!'
      );
    } catch (error) {
      console.error('Error completing call:', error);
      Alert.alert('Error', 'Failed to complete the call verification.');
    }
  }, []);

  // Mark call as failed/no response
  const declineCall = useCallback(async (callId: string) => {
    try {
      await verificationCallsApi.markCallFailed(callId);
      setPendingCall(null);
    } catch (error) {
      console.error('Error declining call:', error);
    }
  }, []);

  // Set up app state listener to check for calls when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkForPendingCalls();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Check on mount
    checkForPendingCalls();

    return () => {
      subscription.remove();
    };
  }, [checkForPendingCalls]);

  // Set up a periodic check every minute
  useEffect(() => {
    const interval = setInterval(() => {
      checkForPendingCalls();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [checkForPendingCalls]);

  return {
    pendingCall,
    isLoading,
    callDuration,
    setCallDuration,
    checkForPendingCalls,
    handleIncomingCall,
    acceptCall,
    completeCall,
    declineCall,
  };
}
