import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="login" 
        options={{ 
          headerShown: false,
          presentation: 'fullScreenModal'
        }} 
      />
      <Stack.Screen 
        name="sign-up" 
        options={{ 
          headerShown: false,
          presentation: 'fullScreenModal'
        }} 
      />
    </Stack>
  );
}
