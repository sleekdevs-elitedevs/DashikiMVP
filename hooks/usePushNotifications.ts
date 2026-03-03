import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, savePushToken, setupNotificationCategories } from '@/lib/notifications';
import { authApi } from '@/api/auth';

export function usePushNotifications() {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Setup notification listeners
  useEffect(() => {
    setupNotificationCategories();

    // Listen for notifications received while app is in foreground
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received in foreground:', notification);
      setNotification(notification);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Register for push notifications
  const registerForNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get current user
      const user = await authApi.getCurrentUser();
      if (!user) {
        console.log('No user logged in, skipping push notification registration');
        setIsLoading(false);
        return;
      }

      // Register for push notifications
      const token = await registerForPushNotificationsAsync();
      
      if (token) {
        console.log('Push token obtained:', token);
        setPushToken(token);
        
        // Save token to database
        await savePushToken(user.id, token);
        console.log('Push token saved to database');
      }
    } catch (error) {
      console.error('Error registering for push notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Request notification permissions and get token
  useEffect(() => {
    registerForNotifications();
  }, [registerForNotifications]);

  return {
    pushToken,
    notification,
    isLoading,
    registerForNotifications,
  };
}
