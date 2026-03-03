import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Check if running in Expo Go (push tokens won't work)
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Check if push notifications are supported (not in Expo Go)
export function isPushNotificationSupported(): boolean {
  return !isExpoGo;
}

// Get push token for the device (only works in development builds, not Expo Go)
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Check if running in Expo Go - push notifications are not supported
  if (isExpoGo) {
    console.log('Running in Expo Go - Push notifications require a development build');
    // Still request permissions for local notifications
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('Local notification permissions not granted');
      return null;
    }
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for notifications');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('challenge-invitations', {
      name: 'Challenge Invitations',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#007AFF',
    });
  }

  try {
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync();
    return pushToken;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

// Save push token to user profile
export async function savePushToken(userId: string, pushToken: string): Promise<void> {
  if (!pushToken || isExpoGo) {
    console.log('Skipping push token save - running in Expo Go or no token');
    return;
  }

  try {
    const { error } = await supabase
      .from('user_push_tokens')
      .upsert({ user_id: userId, push_token: pushToken, updated_at: new Date().toISOString() });

    if (error) {
      console.error('Error saving push token:', error);
    }
  } catch (error) {
    console.error('Error saving push token:', error);
  }
}

// Send local notification (works in Expo Go and development builds)
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Send immediately
    });
    console.log('Local notification sent:', title);
  } catch (error) {
    console.error('Error sending local notification:', error);
  }
}

// Send push notification to a user (only works in development builds)
export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (isExpoGo) {
    console.log('Push notifications not available in Expo Go - use local notification instead');
    return;
  }

  const message = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data,
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error('Failed to send push notification:', response.statusText);
    } else {
      console.log('Push notification sent successfully');
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

// Get all push tokens for users to notify
export async function getPushTokensForUsers(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from('user_push_tokens')
      .select('push_token')
      .in('user_id', userIds)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching push tokens:', error);
      return [];
    }

    return data?.map(item => item.push_token).filter(Boolean) || [];
  } catch (error) {
    console.error('Error fetching push tokens:', error);
    return [];
  }
}

// Notification categories for actions
export function setupNotificationCategories(): void {
  Notifications.addNotificationReceivedListener((notification) => {
    console.log('Notification received:', notification);
  });

  Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('Notification response:', response);
    const data = response.notification.request.content.data;
    
    if (data?.challenge_id) {
      // Handle navigation to challenge
      // This would typically use expo-router's router
    }
  });
}
