import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { walletApi, Wallet } from '@/api/wallet';
import { transactionsApi, Transaction } from '@/api/transactions';
import { participantsApi } from '@/api/participants';
import { challengesApi } from '@/api/challenges';
import { authApi } from '@/api/auth';
import { useState, useEffect, useCallback } from 'react';

interface ExtendedTransaction extends Transaction {
  isChallengeDeduction?: boolean;
  challengeId?: string;
}

export default function LedgerScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const router = useRouter();
  
  // State
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<ExtendedTransaction[]>([]);
  const [totalStakes, setTotalStakes] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Theme colors
  const backgroundColor = Colors[colorScheme ?? 'light'].background;
  const textColor = Colors[colorScheme ?? 'light'].text;
  const tintColor = Colors[colorScheme ?? 'light'].tint;
  const iconColor = Colors[colorScheme ?? 'light'].icon;

  // Helper function to truncate title
  const truncateTitle = (title: string, maxLength: number = 20) => {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  };

  // Handle transaction click - navigate to challenge detail if it's a challenge deduction
  const handleTransactionClick = (transaction: ExtendedTransaction) => {
    if (transaction.isChallengeDeduction && transaction.challengeId) {
      router.push(`/challenge/${transaction.challengeId}`);
    }
  };

  // Fetch wallet and transactions data
  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      const user = await authApi.getCurrentUser();
      if (user) {
        // Fetch wallet
        const walletData = await walletApi.getByUserId(user.id);
        setWallet(walletData);

        // Fetch recent transactions
        const transactionsData = await transactionsApi.getRecent(user.id, 10);
        
        // Fetch challenge participations (these are deductions)
        const participations = await participantsApi.getByUser(user.id);
        
        // Get unique challenge IDs and fetch their titles
        const challengeIds = [...new Set(participations.map(p => p.challenge_id))];
        const challengeTitles: Record<string, string> = {};
        
        for (const challengeId of challengeIds) {
          try {
            const challenge = await challengesApi.getById(challengeId);
            if (challenge) {
              challengeTitles[challengeId] = challenge.title;
            }
          } catch (e) {
            console.error('Error fetching challenge:', e);
          }
        }
        
        // Transform participations into expense transactions
        const participationTransactions: ExtendedTransaction[] = participations
          .filter(p => p.stake_on_join && p.stake_on_join > 0)
          .map((p): ExtendedTransaction => ({
            id: p.id,
            user_id: p.user_id,
            title: challengeTitles[p.challenge_id] || 'Challenge Entry',
            amount: -Math.abs(p.stake_on_join || 0), // Negative for expense
            type: 'expense',
            category: 'Challenge',
            date: p.joined_at.split('T')[0],
            created_at: p.joined_at,
            isChallengeDeduction: true,
            challengeId: p.challenge_id,
          }))
          .slice(0, 5); // Limit to 5 recent challenges
        
        // Combine regular transactions with challenge deductions
        const combinedTransactions = [...transactionsData, ...participationTransactions];
        
        // Sort by date (most recent first)
        combinedTransactions.sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        
        // Take only the first 10
        setTransactions(combinedTransactions.slice(0, 10));

        // Fetch total stakes spent on challenges
        const stakesData = await participantsApi.getTotalStakesByUser(user.id);
        setTotalStakes(stakesData);
      }
    } catch (error) {
      console.error('Error fetching ledger data:', error);
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  }, []);

  // Handle pull-to-refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate totals from transactions
  const totalBalance = wallet?.balance || 0;
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getCategoryIcon = (category: string, isChallenge?: boolean) => {
    if (isChallenge) return '🎯';
    switch (category) {
      case 'Rewards':
        return '🏆';
      case 'Bonus':
        return '⭐️';
      case 'Subscription':
        return '📱';
      case 'Upgrade':
        return '✨';
      case 'Referral':
        return '👥';
      case 'Deposit':
        return '💳';
      case 'Challenge':
        return '🎯';
      default:
        return '💰';
    }
  };

  if (loading) {
    return (
      <View style={{ ...styles.container, paddingTop: insets.top, backgroundColor, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={tintColor} />
      </View>
    );
  }

  return (
    <View style={{ ...styles.container, paddingTop: insets.top, backgroundColor }}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={backgroundColor} />
      
      {/* Header */}
      <View style={{...styles.header, backgroundColor}}>
        <Text style={{...styles.title, color: textColor}}>Ledger</Text>
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>${totalBalance.toFixed(2)}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>📈</Text>
            <Text style={styles.statLabel}>Income</Text>
            <Text style={[styles.statValue, { color: '#2ed573' }]}>+${totalIncome.toFixed(2)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>🎯</Text>
            <Text style={styles.statLabel}>Challenges</Text>
            <Text style={[styles.statValue, { color: '#ff4757' }]}>-${totalStakes.toFixed(2)}</Text>
          </View>
        </View>
        {/* Add Funds Button */}
        <TouchableOpacity 
          style={styles.addFundsButton}
          onPress={() => router.push('/add-funds')}
        >
          <Text style={styles.addFundsButtonText}>Add Funds</Text>
        </TouchableOpacity>
      </View>

      {/* Transactions Header */}
      <View style={{...styles.transactionsHeader, backgroundColor}}>
        <Text style={{...styles.transactionsTitle, color: textColor}}>Recent Transactions</Text>
        <TouchableOpacity onPress={() => router.push('/transactions')}>
          <Text style={{...styles.seeAllText, color: tintColor}}>See All</Text>
        </TouchableOpacity>
      </View>

      {/* Transactions List */}
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        style={styles.transactionsList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tintColor}
            colors={[tintColor]}
          />
        }
      >
        {transactions.length > 0 ? (
          transactions.map((transaction) => (
            <TouchableOpacity 
              key={transaction.id} 
              style={{...styles.transactionCard, backgroundColor}}
              onPress={() => handleTransactionClick(transaction)}
              disabled={!transaction.isChallengeDeduction}
            >
              <View style={styles.transactionLeft}>
                <Text style={styles.categoryIcon}>
                  {getCategoryIcon(transaction.category, transaction.isChallengeDeduction)}
                </Text>
                <View style={styles.transactionInfo}>
                  <Text style={{...styles.transactionTitle, color: textColor}}>
                    {transaction.isChallengeDeduction 
                      ? truncateTitle(transaction.title) 
                      : transaction.title}
                  </Text>
                  <Text style={{...styles.transactionDate, color: iconColor}}>
                    {formatDate(transaction.date)} • {transaction.category}
                  </Text>
                </View>
              </View>
              <Text style={[
                styles.transactionAmount,
                transaction.type === 'income' ? styles.incomeAmount : styles.expenseAmount
              ]}>
                {transaction.type === 'income' ? '+' : ''}{transaction.amount.toFixed(2)}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={{...styles.emptyText, color: iconColor}}>No transactions yet</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  filterButton: {
    padding: 8,
  },
  filterText: {
    fontSize: 16,
    fontWeight: '600',
  },
  balanceCard: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#8e8e8e',
    marginBottom: 5,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#333',
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#8e8e8e',
    marginBottom: 3,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
    marginTop: 10,
  },
  transactionsTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  transactionsList: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  transactionCard: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  transactionDate: {
    fontSize: 12,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  incomeAmount: {
    color: '#2ed573',
  },
  expenseAmount: {
    color: '#ff4757',
  },
  addFundsButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
    alignItems: 'center',
  },
  addFundsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
  },
});
