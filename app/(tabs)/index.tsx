import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';
import ChallengeCard, { FullChallenge } from '@/components/challenge-card';
import { challengesApi, Challenge } from '@/api/challenges';
import { profilesApi } from '@/api/profiles';
import { friendsApi } from '@/api/friends';
import { notificationsApi } from '@/api/notifications';

const { width } = Dimensions.get('window');

const FILTERS = [
  { id: 'ending-soon', label: 'Ending Soon', color: '#ff6b6b' },
  { id: 'new', label: 'New', color: '#4ecdc4' },
  { id: 'high-stake', label: 'High Stake', color: '#ffe66d' },
  { id: 'flash', label: 'Flash', color: '#95e1d3' },
  { id: 'past', label: 'Past Events', color: '#a8a8a8' },
];

// Map API Challenge to FullChallenge for the component
const mapChallengeToFullChallenge = async (challenge: Challenge): Promise<FullChallenge> => {
  let createdBy = undefined;
  
  if (challenge.creator_id) {
    try {
      const creator = await profilesApi.getById(challenge.creator_id);
      if (creator) {
        createdBy = {
          id: creator.id,
          username: creator.username,
          avatar: creator.avatar_url || undefined,
        };
      }
    } catch (error) {
      console.error('Error fetching creator:', error);
    }
  }

  return {
    id: parseInt(challenge.id.replace(/-/g, '').substring(0, 8), 16),
    uuid: challenge.id, // Store the original UUID
    title: challenge.title,
    description: challenge.description,
    participants: challenge.participants_count,
    daysLeft: challenge.days_left,
    difficulty: challenge.difficulty,
    category: challenge.category,
    status: challenge.status,
    videoRequirements: challenge.video_requirements || undefined,
    schedule: challenge.schedule_days ? {
      days: challenge.schedule_days,
      time: challenge.schedule_time || '00:00',
      repeat: (challenge.schedule_repeat as any) || 'daily',
      startTime: challenge.schedule_start_time || undefined,
      endTime: challenge.schedule_end_time || undefined,
    } : undefined,
    entryFee: challenge.entry_fee,
    potentialReward: challenge.potential_reward,
    createdBy,
  };
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const [activeTab, setActiveTab] = useState<'school' | 'global'>('school');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [challenges, setChallenges] = useState<FullChallenge[]>([]);
  const [friendChallenges, setFriendChallenges] = useState<FullChallenge[]>([]);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [pendingFriendRequestsCount, setPendingFriendRequestsCount] = useState(0);

  const backgroundColor = Colors[colorScheme ?? 'light'].background;
  const textColor = Colors[colorScheme ?? 'light'].text;
  const tintColor = Colors[colorScheme ?? 'light'].tint;
  const iconColor = Colors[colorScheme ?? 'light'].icon;

  // Fetch friends of the current user
  const fetchFriends = useCallback(async () => {
    if (!user?.id) return [];
    try {
      const friends = await friendsApi.getFriends(user.id);
      const ids = friends.map(f => f.user_id === user.id ? f.friend_id : f.user_id);
      setFriendIds(ids);
      return ids;
    } catch (error) {
      console.error('Error fetching friends:', error);
      return [];
    }
  }, [user?.id]);

  // Fetch pending friend requests count
  const fetchPendingFriendRequests = useCallback(async () => {
    if (!user?.id) return;
    try {
      const requests = await friendsApi.getPendingRequests(user.id);
      setPendingFriendRequestsCount(requests.length);
    } catch (error) {
      console.error('Error fetching pending friend requests:', error);
    }
  }, [user?.id]);

  // Fetch all challenges from API
  const fetchAllChallenges = useCallback(async () => {
    try {
      const data = await challengesApi.getAll();
      // Map to FullChallenge format
      const mappedChallenges = await Promise.all(
        data.map(challenge => mapChallengeToFullChallenge(challenge))
      );
      setChallenges(mappedChallenges);
    } catch (error) {
      console.error('Error fetching challenges:', error);
    }
  }, []);

  // Fetch challenges where friends have joined
  const fetchFriendChallenges = useCallback(async (friendIds: string[]) => {
    if (friendIds.length === 0) {
      setFriendChallenges([]);
      return;
    }
    try {
      const data = await challengesApi.getByFriends(user!.id, friendIds);
      const mappedChallenges = await Promise.all(
        data.map(challenge => mapChallengeToFullChallenge(challenge))
      );
      setFriendChallenges(mappedChallenges);
    } catch (error) {
      console.error('Error fetching friend challenges:', error);
    }
  }, [user?.id]);

  // Fetch challenges from API
  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    await fetchAllChallenges();
    
    // Also fetch friends and their challenges if user is logged in
    if (user?.id) {
      const ids = await fetchFriends();
      await fetchFriendChallenges(ids);
      // Fetch unread notifications count
      try {
        const count = await notificationsApi.getUnreadCount(user.id);
        setUnreadNotificationsCount(count);
      } catch (error) {
        console.error('Error fetching unread notifications count:', error);
      }
      // Fetch pending friend requests count
      await fetchPendingFriendRequests();
    }
    
    setLoading(false);
  }, [fetchAllChallenges, fetchFriends, fetchFriendChallenges, fetchPendingFriendRequests, user?.id]);

  // Handle pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchChallenges();
    setRefreshing(false);
  }, [fetchChallenges]);

  useEffect(() => {
    if (!authLoading) {
      fetchChallenges();
    }
  }, [authLoading, fetchChallenges]);

  // Clear all filters and search
  const clearFilters = () => {
    setActiveFilter(null);
    setSearchQuery('');
  };

  // Check if any filters are active
  const hasActiveFilters = activeFilter !== null || searchQuery.trim() !== '';

  // Filter challenges based on search and filter
  const filterChallenges = useCallback((challengeList: FullChallenge[]) => {
    let filtered = challengeList;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(challenge => 
        challenge.title.toLowerCase().includes(query) ||
        challenge.description.toLowerCase().includes(query) ||
        challenge.category.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (activeFilter) {
      if (activeFilter === 'ending-soon') {
        filtered = filtered.filter(challenge => challenge.daysLeft <= 10);
      } else if (activeFilter === 'new') {
        filtered = filtered.filter(challenge => challenge.daysLeft >= 20);
      } else if (activeFilter === 'high-stake') {
        filtered = filtered.filter(challenge => challenge.difficulty === 'Hard');
      } else if (activeFilter === 'flash') {
        filtered = filtered.filter(challenge => challenge.daysLeft <= 5);
      }
      // 'past' is handled separately - don't show past events
    }

    return filtered;
  }, [searchQuery, activeFilter]);

  // Get filtered challenges based on active tab
  const filteredChallenges = useMemo(() => {
    const sourceChallenges = activeTab === 'school' ? friendChallenges : challenges;
    return filterChallenges(sourceChallenges);
  }, [activeTab, friendChallenges, challenges, filterChallenges]);

  const handleChallengePress = (challenge: FullChallenge) => {
    // Use UUID if available, otherwise fall back to numeric ID
    const challengeId = challenge.uuid || challenge.id.toString();
    router.push({ pathname: '/challenge/[id]', params: { id: challengeId } });
  };

  const handleCreatorPress = (creatorId: string | number) => {
    router.push({ pathname: '/profile/[id]', params: { id: creatorId.toString() } });
  };

  const handleSettingsPress = () => router.push('/settings');
  const handleNotificationsPress = () => router.push('/notifications');
  const handleFriendsPress = () => router.push('/friends');

  if (loading || authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor, paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={tintColor} />
      </View>
    );
  }

  // Empty state component
  const renderEmptyState = (isFriendTab: boolean) => (
    <View style={styles.emptyState}>
      <Ionicons size={64} name={isFriendTab ? "people-outline" : "search-outline"} color={iconColor} />
      <Text style={[styles.emptyTitle, { color: textColor }]}>No Challenges Found</Text>
      <Text style={[styles.emptyMessage, { color: iconColor }]}>
        {hasActiveFilters
          ? 'Try adjusting your search or filters'
          : isFriendTab 
            ? 'No challenges with friends yet'
            : 'No challenges available yet'}
      </Text>
      {hasActiveFilters && (
        <TouchableOpacity
          style={[styles.clearButton, { backgroundColor: tintColor }]}
          onPress={clearFilters}
        >
          <Text style={styles.clearButtonText}>Clear Filters</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor, paddingTop: insets.top }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.logo, { color: textColor }]}>Dashiki</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={handleFriendsPress} style={styles.notificationButton}>
            <Ionicons size={24} name="people-outline" color={iconColor} />
            {pendingFriendRequestsCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {pendingFriendRequestsCount > 99 ? '99+' : pendingFriendRequestsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNotificationsPress} style={styles.notificationButton}>
            <Ionicons size={24} name="notifications-outline" color={iconColor} />
            {unreadNotificationsCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSettingsPress} style={{ marginLeft: 15 }}>
            <Ionicons size={24} name="settings-outline" color={iconColor} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'school' && { borderBottomColor: tintColor }]}
          onPress={() => setActiveTab('school')}
        >
          <Text style={[styles.tabText, activeTab === 'school' && { color: tintColor }]}>Friends</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'global' && { borderBottomColor: tintColor }]}
          onPress={() => setActiveTab('global')}
        >
          <Text style={[styles.tabText, activeTab === 'global' && { color: tintColor }]}>Global</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#f0f0f0' }]}>
          <Ionicons size={20} name="search" color={iconColor} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Search challenges..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons size={20} name="close-circle" color={iconColor} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Pills with Clear Option */}
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
        >
          {FILTERS.map(filter => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterPill,
                {
                  backgroundColor: activeFilter === filter.id ? filter.color : (colorScheme === 'dark' ? '#333' : '#f0f0f0'),
                },
              ]}
              onPress={() => setActiveFilter(activeFilter === filter.id ? null : filter.id)}
            >
              <Text style={[styles.filterText, { color: activeFilter === filter.id ? '#fff' : textColor }]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {hasActiveFilters && (
          <TouchableOpacity onPress={clearFilters} style={styles.clearFiltersButton}>
            <Ionicons size={18} name="close" color={tintColor} />
            <Text style={[styles.clearFiltersText, { color: tintColor }]}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Challenge List with Pull to Refresh */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        onMomentumScrollEnd={(e) => {
          const page = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveTab(page === 0 ? 'school' : 'global');
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tintColor}
            colors={[tintColor]}
          />
        }
      >
        {/* Friends Tab */}
        <View style={{ width }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              filteredChallenges.length === 0 && styles.emptyScrollContent
            ]}
          >
            {filteredChallenges.length > 0 ? (
              filteredChallenges.map(challenge => (
                <ChallengeCard 
                  key={challenge.uuid || challenge.id} 
                  challenge={challenge} 
                  onPress={() => handleChallengePress(challenge)}
                  onCreatorPress={handleCreatorPress}
                />
              ))
            ) : (
              renderEmptyState(true)
            )}
          </ScrollView>
        </View>

        {/* Global Tab */}
        <View style={{ width }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              filteredChallenges.length === 0 && styles.emptyScrollContent
            ]}
          >
            {filteredChallenges.length > 0 ? (
              filteredChallenges.map(challenge => (
                <ChallengeCard
                  key={`global-${challenge.uuid || challenge.id}`}
                  challenge={{ ...challenge, participants: challenge.participants * 3 }}
                  onPress={() => handleChallengePress(challenge)}
                  onCreatorPress={handleCreatorPress}
                />
              ))
            ) : (
              renderEmptyState(false)
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  logo: { fontSize: 28, fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  notificationButton: { position: 'relative', marginLeft: 15 },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ff6b6b',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },

  tabContainer: { flexDirection: 'row', paddingHorizontal: 15 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 16, fontWeight: '600', color: '#8e8e8e' },

  searchContainer: { paddingHorizontal: 15, paddingVertical: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16 },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 15,
  },
  filtersContainer: { paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  filterPill: { height: 36, paddingHorizontal: 16, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  filterText: { fontSize: 14, fontWeight: '500' },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },

  scrollContent: { paddingHorizontal: 15, paddingBottom: 20, justifyContent: 'flex-start' },
  emptyScrollContent: { flex: 1, justifyContent: 'center' },

  // Empty State Styles
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  clearButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
