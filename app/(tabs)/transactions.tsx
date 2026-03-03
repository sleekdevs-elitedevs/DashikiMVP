import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { transactionsApi, Transaction } from '@/api/transactions';
import { participantsApi } from '@/api/participants';
import { challengesApi } from '@/api/challenges';
import { authApi } from '@/api/auth';

type FilterType = 'all' | 'income' | 'expense';

interface ExtendedTransaction extends Transaction {
  isChallengeDeduction?: boolean;
  challengeId?: string;
}

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const router = useRouter();
  
  // Theme colors
  const backgroundColor = Colors[colorScheme ?? 'light'].background;
  const textColor = Colors[colorScheme ?? 'light'].text;
  const tintColor = Colors[colorScheme ?? 'light'].tint;
  const iconColor = Colors[colorScheme ?? 'light'].icon;
  
  // State
  const [transactions, setTransactions] = useState<ExtendedTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  // Fetch transactions and challenge participations from API
  const fetchTransactions = useCallback(async () => {
    try {
      const user = await authApi.getCurrentUser();
      if (user) {
        // Fetch regular transactions
        const data = await transactionsApi.getByUser(user.id);
        
        // Fetch challenge participations (these are expenses - deductions)
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
          }));
        
        // Combine regular transactions with challenge deductions
        const combinedTransactions = [...data, ...participationTransactions];
        
        // Sort by date (most recent first)
        combinedTransactions.sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        
        setTransactions(combinedTransactions);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  // Filter transactions based on search and filter
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    
    // Apply type filter
    if (activeFilter === 'income') {
      filtered = filtered.filter(t => t.type === 'income');
    } else if (activeFilter === 'expense') {
      filtered = filtered.filter(t => t.type === 'expense');
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [transactions, searchQuery, activeFilter]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

  const formatAmount = (amount: number) => {
    const prefix = amount >= 0 ? '+' : '';
    return `${prefix}$${Math.abs(amount).toFixed(2)}`;
  };

  const renderFilterTab = (filter: FilterType, label: string) => {
    const isActive = activeFilter === filter;
    return (
      <TouchableOpacity
        key={filter}
        style={[
          styles.filterTab,
          isActive && { backgroundColor: tintColor }
        ]}
        onPress={() => setActiveFilter(filter)}
      >
        <Text style={[
          styles.filterTabText,
          isActive && { color: '#fff' }
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
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
      <View style={{...styles.header, backgroundColor: backgroundColor}}>
        <Text style={{...styles.title, color: textColor}}>Transactions</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#f0f0f0' }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Search transactions..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabsContainer}>
        {renderFilterTab('all', 'All')}
        {renderFilterTab('income', 'Income')}
        {renderFilterTab('expense', 'Expense')}
      </View>

      {/* Transactions Header */}
      <View style={{...styles.transactionsHeader, backgroundColor}}>
        <Text style={{...styles.transactionsTitle, color: textColor}}>All Transactions</Text>
        <Text style={{...styles.transactionCount, color: iconColor}}>
          {filteredTransactions.length} items
        </Text>
      </View>

      {/* Transactions List */}
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        style={styles.transactionsList}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={tintColor}
          />
        }
      >
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((transaction) => (
            <TouchableOpacity 
              key={transaction.id} 
              style={{...styles.transactionCard, backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#fff'}}
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
                {formatAmount(transaction.amount)}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={{...styles.emptyText, color: textColor}}>No transactions found</Text>
            <Text style={{...styles.emptySubtext, color: iconColor}}>Try adjusting your search or filters</Text>
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
  searchContainer: {
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  clearIcon: {
    fontSize: 16,
    color: '#999',
    padding: 4,
  },
  filterTabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#f0f0f0',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  balanceCard: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 15,
    marginBottom: 15,
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
    paddingVertical: 10,
  },
  transactionsTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  transactionCount: {
    fontSize: 14,
  },
  transactionsList: {
    flex: 1,
    paddingHorizontal: 15,
  },
  listContent: {
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
  },
});
