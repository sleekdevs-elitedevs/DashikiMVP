// Auth API Service
// Handles all authentication operations for the app

import { supabase } from '../lib/supabase';
import { router } from 'expo-router';

export interface SignUpInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  error?: string;
  data?: any;
}

export const authApi = {
  // Sign up a new user
  async signUp(input: SignUpInput): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message || 'An unexpected error occurred' };
    }
  },

  // Sign in with email and password
  async signIn(input: LoginInput): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message || 'An unexpected error occurred' };
    }
  },

  // Sign out the current user
  async signOut(): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'An unexpected error occurred' };
    }
  },

  // Get the current authenticated user
  async getCurrentUser() {
    try {
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        return null;
      }

      return data.user;
    } catch (error) {
      return null;
    }
  },

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return !!user;
  },

  // Navigate to appropriate screen after auth check
  async handleAuthState(): Promise<void> {
    const isAuth = await this.isAuthenticated();
    if (isAuth) {
      router.replace('/(tabs)');
    } else {
      router.replace('/auth/login');
    }
  },

  // Navigate to login screen
  navigateToLogin(): void {
    router.push('/auth/login');
  },

  // Navigate to sign up screen
  navigateToSignUp(): void {
    router.push('/auth/sign-up');
  },

  // Navigate to main app after successful login/signup
  navigateToApp(): void {
    router.replace('/(tabs)');
  },
};
