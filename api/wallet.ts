// Wallet API Service
// Handles all database operations for the user_wallets table

import { supabase } from '../lib/supabase';

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  total_earned: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateWalletInput {
  balance?: number;
  total_earned?: number;
  total_spent?: number;
}

export const walletApi = {
  // Get wallet by user ID
  async getByUserId(userId: string): Promise<Wallet | null> {
    const { data, error } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get wallet by wallet ID
  async getById(id: string): Promise<Wallet | null> {
    const { data, error } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Create a new wallet
  async create(userId: string, initialBalance: number = 0): Promise<Wallet> {
    const { data, error } = await supabase
      .from('user_wallets')
      .insert({
        user_id: userId,
        balance: initialBalance,
        total_earned: 0,
        total_spent: 0,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update wallet
  async update(userId: string, updates: UpdateWalletInput): Promise<Wallet> {
    const { data, error } = await supabase
      .from('user_wallets')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Add funds to wallet (deposit)
  async addFunds(userId: string, amount: number): Promise<Wallet> {
    const wallet = await this.getByUserId(userId);
    
    if (!wallet) {
      // Create wallet if it doesn't exist
      return this.create(userId, amount);
    }
    
    const newBalance = wallet.balance + amount;
    const newTotalEarned = wallet.total_earned + amount;
    
    return this.update(userId, {
      balance: newBalance,
      total_earned: newTotalEarned,
    });
  },

  // Deduct funds from wallet (withdrawal/payment)
  async deductFunds(userId: string, amount: number): Promise<Wallet> {
    const wallet = await this.getByUserId(userId);
    
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    if (wallet.balance < amount) {
      throw new Error('Insufficient funds');
    }
    
    const newBalance = wallet.balance - amount;
    const newTotalSpent = wallet.total_spent + amount;
    
    return this.update(userId, {
      balance: newBalance,
      total_spent: newTotalSpent,
    });
  },

  // Check if user has sufficient funds
  async hasSufficientFunds(userId: string, amount: number): Promise<boolean> {
    const wallet = await this.getByUserId(userId);
    
    if (!wallet) {
      return false;
    }
    
    return wallet.balance >= amount;
  },

  // Get balance for a user
  async getBalance(userId: string): Promise<number> {
    const wallet = await this.getByUserId(userId);
    return wallet?.balance || 0;
  },

  // Initialize wallet if it doesn't exist
  async initializeWallet(userId: string): Promise<Wallet> {
    const existingWallet = await this.getByUserId(userId);
    
    if (existingWallet) {
      return existingWallet;
    }
    
    return this.create(userId, 0);
  },
};
