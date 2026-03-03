import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';
import { profilesApi, friendsApi } from '@/api';
import type { Profile } from '@/api/profiles';
import type { FriendWithProfile } from '@/api/friends';

type TabType = 'friends' | 'search' | 'requests';

// Format numbers: 1000 -> 1K, 1000000 -> 1M, 1234 -> 1,234
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toLocaleString();
};

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const currentUserId = user?.id;

  const loadFriends = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const friendsList = await friendsApi.getFriends(currentUserId);
      setFriends(friendsList);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  }, [currentUserId]);

  const loadPendingRequests = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const requests = await friendsApi.getPendingRequests(currentUserId);
      setPendingRequests(requests);
    } catch (error) {
      console.error('Error loading pending requests:', error);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUserId) return;
    
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([loadFriends(), loadPendingRequests()]);
      setIsLoading(false);
    };
    loadData();
  }, [authLoading, currentUserId, loadFriends, loadPendingRequests]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadFriends(), loadPendingRequests()]);
    setRefreshing(false);
  }, [loadFriends, loadPendingRequests]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (!currentUserId) return;
    
    setIsSearching(true);
    try {
      const results = await profilesApi.searchByUsername(searchQuery.trim());
      // Filter out current user
      setSearchResults(results.filter(p => p.id !== currentUserId));
    } catch (error) {
      console.error('Error searching:', error);
      Alert.alert('Error', 'Failed to search users');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFriend = async (friendId: string) => {
    if (!currentUserId) {
      Alert.alert('Error', 'You must be logged in to add friends');
      return;
    }
    try {
      await friendsApi.sendRequest({
        user_id: currentUserId,
        friend_id: friendId,
      });
      Alert.alert('Success', 'Friend request sent!');
      // Refresh search results to show pending status
      handleSearch();
    } catch (error: any) {
      if (error.message?.includes('duplicate')) {
        Alert.alert('Info', 'Friend request already sent or you are already friends');
      } else {
        console.error('Error adding friend:', error);
        Alert.alert('Error', 'Failed to send friend request');
      }
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    if (!currentUserId) return;
    try {
      await friendsApi.acceptRequest(requestId, currentUserId);
      Alert.alert('Success', 'Friend request accepted!');
      loadPendingRequests();
      loadFriends();
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', 'Failed to accept request');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!currentUserId) return;
    try {
      await friendsApi.rejectRequest(requestId, currentUserId);
      loadPendingRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      Alert.alert('Error', 'Failed to reject request');
    }
  };

  const handleUserPress = (userId: string) => {
    router.push({ pathname: '/profile/[id]', params: { id: userId } });
  };

  const renderTab = (tab: TabType, label: string, icon: string, badgeCount?: number) => (
    <TouchableOpacity
      style={[
        styles.tab,
        activeTab === tab && { backgroundColor: colors.tint },
      ]}
      onPress={() => setActiveTab(tab)}
    >
      <Ionicons
        name={icon as any}
        size={20}
        color={activeTab === tab ? '#fff' : colors.text}
      />
      <Text
        style={[
          styles.tabText,
          { color: activeTab === tab ? '#fff' : colors.text },
        ]}
      >
        {label}
      </Text>
      {badgeCount !== undefined && badgeCount > 0 && (
        <View style={[styles.badge, { backgroundColor: '#ff4444' }]}>
          <Text style={styles.badgeText}>
            {formatNumber(badgeCount)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderFriendItem = (friend: FriendWithProfile, isRequest = false) => {
    const profile = (friend as any).friend_profile || (friend as any).user_profile;
    if (!profile) return null;
    
    return (
      <TouchableOpacity
        key={friend.id}
        style={[styles.friendItem, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}
        onPress={() => handleUserPress(profile.id)}
      >
        <Image
          source={{ uri: profile.avatar_url || 'https://i.pravatar.cc/150?img=0' }}
          style={styles.avatar}
        />
        <View style={styles.friendInfo}>
          <Text style={[styles.username, { color: colors.text }]}>
            {profile.username}
          </Text>
          {isRequest && (
            <Text style={[styles.requestText, { color: colors.icon }]}>
              Wants to be your friend
            </Text>
          )}
        </View>
        {isRequest ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.acceptButton, { backgroundColor: colors.tint }]}
              onPress={() => handleAcceptRequest(friend.id)}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectButton, { backgroundColor: '#ff4444' }]}
              onPress={() => handleRejectRequest(friend.id)}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={24} color={colors.icon} />
        )}
      </TouchableOpacity>
    );
  };

  const renderSearchResult = (profile: Profile) => (
    <TouchableOpacity
      key={profile.id}
      style={[styles.friendItem, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}
      onPress={() => handleUserPress(profile.id)}
    >
      <Image
        source={{ uri: profile.avatar_url || 'https://i.pravatar.cc/150?img=0' }}
        style={styles.avatar}
      />
      <View style={styles.friendInfo}>
        <Text style={[styles.username, { color: colors.text }]}>
          {profile.username}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: colors.tint }]}
        onPress={() => handleAddFriend(profile.id)}
      >
        <Ionicons name="person-add" size={20} color="#fff" />
        <Text style={styles.addButtonText}>Add</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // Show loading while checking auth
  if (authLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} style={styles.loader} />
      </View>
    );
  }

  // Show message if not logged in
  if (!currentUserId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Friends</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={64} color={colors.icon} />
          <Text style={[styles.emptyText, { color: colors.icon }]}>
            Please log in to view friends
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Friends</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {renderTab('friends', 'Friends', 'people', friends.length)}
        {renderTab('search', 'Search', 'search')}
        {renderTab('requests', 'Requests', 'mail', pendingRequests.length)}
      </View>

      {/* Content */}
      {activeTab === 'search' && (
        <View style={styles.searchContainer}>
          <View style={[styles.searchInputContainer, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
            <Ionicons name="search" size={20} color={colors.icon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search by username..."
              placeholderTextColor={colors.icon}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                <Ionicons name="close-circle" size={20} color={colors.icon} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.tint} style={styles.loader} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.tint}
              colors={[colors.tint]}
            />
          }
        >
          {activeTab === 'friends' && (
            friends.length > 0 ? (
              friends.map(friend => renderFriendItem(friend))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color={colors.icon} />
                <Text style={[styles.emptyText, { color: colors.icon }]}>
                  No friends yet
                </Text>
                <Text style={[styles.emptySubtext, { color: colors.icon }]}>
                  Search for users to add friends!
                </Text>
              </View>
            )
          )}

          {activeTab === 'search' && (
            <>
              {isSearching ? (
                <ActivityIndicator size="small" color={colors.tint} style={styles.loader} />
              ) : searchResults.length > 0 ? (
                searchResults.map(profile => renderSearchResult(profile))
              ) : searchQuery.length > 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={64} color={colors.icon} />
                  <Text style={[styles.emptyText, { color: colors.icon }]}>
                    No users found
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={64} color={colors.icon} />
                  <Text style={[styles.emptyText, { color: colors.icon }]}>
                    Search for friends
                  </Text>
                  <Text style={[styles.emptySubtext, { color: colors.icon }]}>
                    Enter a username to find people
                  </Text>
                </View>
              )}
            </>
          )}

          {activeTab === 'requests' && (
            pendingRequests.length > 0 ? (
              pendingRequests.map(request => renderFriendItem(request, true))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="mail-outline" size={64} color={colors.icon} />
                <Text style={[styles.emptyText, { color: colors.icon }]}>
                  No pending requests
                </Text>
              </View>
            )
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginBottom: 15,
    gap: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  content: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  },
  requestText: {
    fontSize: 12,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
  },
  loader: {
    marginTop: 40,
  },
});
