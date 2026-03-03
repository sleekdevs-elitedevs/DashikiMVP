import React, { createContext, useContext, useState, ReactNode } from 'react';

// Transaction type definition
type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: number;
  title: string;
  date: string;
  amount: number;
  type: TransactionType;
  category: string;
}

// Extended mock data for ledger transactions
const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 1,
    title: 'Challenge Reward',
    date: '2024-01-15',
    amount: 50.00,
    type: 'income',
    category: 'Rewards',
  },
  {
    id: 2,
    title: 'Daily Check-in Bonus',
    date: '2024-01-14',
    amount: 10.00,
    type: 'income',
    category: 'Bonus',
  },
  {
    id: 3,
    title: 'Premium Subscription',
    date: '2024-01-13',
    amount: -9.99,
    type: 'expense',
    category: 'Subscription',
  },
  {
    id: 4,
    title: 'Challenge Completion',
    date: '2024-01-12',
    amount: 100.00,
    type: 'income',
    category: 'Rewards',
  },
  {
    id: 5,
    title: 'Streak Bonus (7 days)',
    date: '2024-01-11',
    amount: 25.00,
    type: 'income',
    category: 'Bonus',
  },
  {
    id: 6,
    title: 'Profile Customization',
    date: '2024-01-10',
    amount: -4.99,
    type: 'expense',
    category: 'Upgrade',
  },
  {
    id: 7,
    title: 'Referral Reward',
    date: '2024-01-09',
    amount: 20.00,
    type: 'income',
    category: 'Referral',
  },
  {
    id: 8,
    title: 'Weekly Challenge Prize',
    date: '2024-01-08',
    amount: 75.00,
    type: 'income',
    category: 'Rewards',
  },
];

interface LedgerContextType {
  transactions: Transaction[];
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  addFunds: (amount: number) => void;
  refreshTransactions: () => void;
}

const LedgerContext = createContext<LedgerContextType | undefined>(undefined);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);

  const calculateTotals = () => {
    const balance = transactions.reduce((sum, t) => sum + t.amount, 0);
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    return { balance, income, expenses };
  };

  const { balance, income, expenses } = calculateTotals();

  const addFunds = (amount: number) => {
    const newTransaction: Transaction = {
      id: Date.now(),
      title: 'Added Funds',
      date: new Date().toISOString().split('T')[0],
      amount: amount,
      type: 'income',
      category: 'Deposit',
    };
    setTransactions([newTransaction, ...transactions]);
  };

  const refreshTransactions = () => {
    // This can be used to refresh from database in the future
    setTransactions([...transactions]);
  };

  return (
    <LedgerContext.Provider
      value={{
        transactions,
        totalBalance: balance,
        totalIncome: income,
        totalExpenses: expenses,
        addFunds,
        refreshTransactions,
      }}
    >
      {children}
    </LedgerContext.Provider>
  );
}

export function useLedger() {
  const context = useContext(LedgerContext);
  if (context === undefined) {
    throw new Error('useLedger must be used within a LedgerProvider');
  }
  return context;
}
