import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { LedgerProvider } from '@/context/LedgerContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export const unstable_settings = {
  anchor: '(tabs)',
};

function NotificationHandler() {
  const { notification } = usePushNotifications();

  useEffect(() => {
    if (notification) {
      console.log('Notification received:', notification);
      // Handle the notification - navigate to challenge if applicable
      const data = notification.request.content.data;
      if (data?.challenge_id) {
        // Navigation will be handled by the notification response listener
      }
    }
  }, [notification]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    subscription.unsubscribe();
  }, []);

  // Show nothing while loading to prevent flash
  if (isLoading) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <LedgerProvider>
          <NotificationHandler />
          <Stack screenOptions={{ headerShown: false }}>
            {session ? (
              // User is authenticated - show main app
              <>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="challenge" />
                <Stack.Screen name="profile" />
                <Stack.Screen name="privacy" />
                <Stack.Screen name="terms" />
                <Stack.Screen name="help" />
                <Stack.Screen name="about" />
                <Stack.Screen name="support" />
                <Stack.Screen name="notifications" />
                <Stack.Screen name="add-funds" />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              </>
            ) : (
              // User is not authenticated - redirect to login
              <>
                <Stack.Screen name="auth" />
                <Stack.Screen name="challenge" />
                <Stack.Screen name="profile" />
                <Stack.Screen name="privacy" />
                <Stack.Screen name="terms" />
                <Stack.Screen name="help" />
                <Stack.Screen name="about" />
                <Stack.Screen name="support" />
                <Stack.Screen name="notifications" />
                <Stack.Screen name="add-funds" />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              </>
            )}
          </Stack>
        </LedgerProvider>
        <StatusBar style="auto" translucent backgroundColor="transparent" />
      </ThemeProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
