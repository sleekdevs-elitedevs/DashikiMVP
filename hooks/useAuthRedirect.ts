import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from './useAuth';
import type { Route } from 'expo-router';

/**
 * Protected Route Hook
 * Redirects unauthenticated users to the login screen
 * 
 * @param redirectTo - Optional custom redirect URL (default: '/auth/login')
 * 
 * @example
 * // Basic usage - redirects to /auth/login
 * function ProtectedPage() {
 *   useAuthRedirect();
 *   return <YourComponent />;
 * }
 * 
 * @example
 * // With custom redirect
 * function ProtectedPage() {
 *   useAuthRedirect('/auth/sign-up');
 *   return <YourComponent />;
 * }
 */
export function useAuthRedirect(redirectTo: '/auth/login' = '/auth/login'): void {
  const { user, loading, isAuthenticated } = useAuth();

  useEffect(() => {
    // Don't redirect while still loading
    if (loading) {
      return;
    }

    // Redirect if not authenticated
    if (!isAuthenticated || !user) {
      router.replace(redirectTo);
    }
  }, [user, loading, isAuthenticated, redirectTo]);
}

/**
 * Guest Route Hook
 * Redirects authenticated users away from public pages (like login/signup)
 * 
 * @param redirectTo - Optional redirect URL after login (default: '/(tabs)')
 * 
 * @example
 * // Redirects to home if already logged in
 * function LoginPage() {
 *   useGuestRedirect('/(tabs)');
 *   return <LoginForm />;
 * }
 */
export function useGuestRedirect(redirectTo: '/(tabs)' = '/(tabs)'): void {
  const { user, loading, isAuthenticated } = useAuth();

  useEffect(() => {
    // Don't redirect while still loading
    if (loading) {
      return;
    }

    // Redirect if already authenticated
    if (isAuthenticated && user) {
      router.replace(redirectTo);
    }
  }, [user, loading, isAuthenticated, redirectTo]);
}

export default useAuthRedirect;
