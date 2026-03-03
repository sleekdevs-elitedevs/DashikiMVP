// Transactions API Service
// Handles all database operations for the transactions table

import { supabase } from '../lib/supabase';

export interface Transaction {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  created_at: string;
}

export interface CreateTransactionInput {
  user_id: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date?: string;
}

export interface UpdateTransactionInput {
  title?: string;
  amount?: number;
  type?: 'income' | 'expense';
  category?: string;
  date?: string;
}

export const transactionsApi = {
  // Get all transactions for a user
  async getByUser(userId: string): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get a single transaction by ID
  async getById(id: string): Promise<Transaction | null> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get transactions by type (income or expense)
  async getByType(userId: string, type: 'income' | 'expense'): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get transactions by category
  async getByCategory(userId: string, category: string): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('category', category)
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get transactions within a date range
  async getByDateRange(userId: string, startDate: string, endDate: string): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get recent transactions for a user (limited)
  async getRecent(userId: string, limit: number = 10): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  },

  // Create a new transaction
  async create(transaction: CreateTransactionInput): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transaction)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update a transaction
  async update(id: string, updates: UpdateTransactionInput): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Delete a transaction
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Get total income for a user
  async getTotalIncome(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'income');
    
    if (error) throw error;
    return data?.reduce((sum, t) => sum + t.amount, 0) || 0;
  },

  // Get total expenses for a user
  async getTotalExpenses(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'expense');
    
    if (error) throw error;
    return data?.reduce((sum, t) => sum + t.amount, 0) || 0;
  },

  // Get transactions by month
  async getByMonth(userId: string, year: number, month: number): Promise<Transaction[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12 
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    
    return this.getByDateRange(userId, startDate, endDate);
  },
};
