import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { router } from 'expo-router';
import { notificationsApi, Notification } from '@/api/notifications';
import { authApi } from '@/api/auth';
import { profilesApi, Profile } from '@/api/profiles';

interface NotificationWithSource extends Notification {
  sourceProfile?: Profile;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [notifications, setNotifications] = useState<NotificationWithSource[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch source profiles for challenge invitations
  const fetchSourceProfiles = useCallback(async (notificationsData: Notification[]): Promise<NotificationWithSource[]> => {
    return Promise.all(
      notificationsData.map(async (notification) => {
        if (notification.source_user_id) {
          try {
            const profile = await profilesApi.getById(notification.source_user_id);
            if (profile) {
              return { ...notification, sourceProfile: profile };
            }
          } catch (error) {
            console.error('Error fetching source profile:', error);
          }
        }
        return notification as NotificationWithSource;
      })
    );
  }, []);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    try {
      const user = await authApi.getCurrentUser();
      if (user) {
        const data = await notificationsApi.getByUser(user.id);
        const notificationsWithSource = await fetchSourceProfiles(data);
        setNotifications(notificationsWithSource);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchSourceProfiles]);

  // Initial load
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.read;
    return true;
  });

  // Count unread notifications
  const unreadCount = notifications.filter(n => !n.read).length;

  // Handle notification press - mark as read and navigate
  const handleNotificationPress = async (notification: Notification) => {
    try {
      await notificationsApi.markAsRead(notification.id);
      setNotifications(prev =>
        prev.map(n => (n.id === notification.id ? { ...n, read: true } : n))
      );
      
      // Navigate based on notification type
      if (notification.type === 'challenge' && notification.challenge_id) {
        router.push({ pathname: '/challenge/[id]', params: { id: notification.challenge_id } });
      }
    } catch (error) {
      console.error('Error handling notification press:', error);
    }
  };

  // Handle mark all as read
  const handleMarkAllRead = async () => {
    try {
      const user = await authApi.getCurrentUser();
      if (user) {
        await notificationsApi.markAllAsRead(user.id);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Handle delete all notifications
  const handleDeleteAll = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteAll = async () => {
    try {
      setIsDeleting(true);
      const user = await authApi.getCurrentUser();
      if (user) {
        // Delete all notifications for this user
        for (const notification of notifications) {
          await notificationsApi.delete(notification.id);
        }
        setNotifications([]);
      }
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      Alert.alert('Error', 'Failed to delete notifications. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    router.back();
  };

  // Get icon for notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'challenge':
        return 'flag';
      case 'reward':
        return 'medal';
      case 'info':
        return 'information-circle';
      case 'system':
        return 'settings';
      default:
        return 'notifications-outline';
    }
  };

  // Format relative time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons size={24} name="arrow-back" color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        {notifications.length > 0 && (
          unreadCount > 0 ? (
            <TouchableOpacity style={styles.markAllButton} onPress={handleMarkAllRead}>
              <Text style={[styles.markAllText, { color: colors.tint }]}>Mark all read</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.markAllButton} onPress={handleDeleteAll}>
              <Text style={[styles.markAllText, { color: '#ff4757' }]}>Delete all</Text>
            </TouchableOpacity>
          )
        )}
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterContainer, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'all' && { borderBottomColor: colors.tint, borderBottomWidth: 2 },
          ]}
          onPress={() => setFilter('all')}
        >
          <Text
            style={[
              styles.filterText,
              { color: filter === 'all' ? colors.tint : colors.icon },
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'unread' && { borderBottomColor: colors.tint, borderBottomWidth: 2 },
          ]}
          onPress={() => setFilter('unread')}
        >
          <Text
            style={[
              styles.filterText,
              { color: filter === 'unread' ? colors.tint : colors.icon },
            ]}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.tint}
          />
        }
      >
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons size={64} name="notifications-outline" color={colors.icon} />
            <Text style={[styles.emptyText, { color: colors.icon }]}>
              No notifications
            </Text>
          </View>
        ) : (
          filteredNotifications.map((notification) => (
            <TouchableOpacity
              key={notification.id}
              style={[
                styles.notificationCard,
                {
                  backgroundColor: notification.read
                    ? colors.background
                    : colors.tint + '10',
                  borderBottomColor: colors.icon + '20',
                },
              ]}
              onPress={() => handleNotificationPress(notification)}
            >
              <View style={styles.iconContainer}>
                {notification.sourceProfile?.avatar_url ? (
                  <Image 
                    source={{ uri: notification.sourceProfile.avatar_url }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Ionicons
                    size={24}
                    name={getNotificationIcon(notification.type) as any}
                    color={colors.tint}
                  />
                )}
              </View>
              <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                  <Text style={[styles.notificationTitle, { color: colors.text }]}>
                    {notification.title}
                  </Text>
                  {!notification.read && <View style={[styles.unreadDot, { backgroundColor: colors.tint }]} />}
                </View>
                
                {/* Challenge Title Badge */}
                {notification.challenge_title && (
                  <View style={[styles.challengeBadge, { backgroundColor: colors.tint + '20' }]}>
                    <Ionicons size={14} name="flag" color={colors.tint} />
                    <Text style={[styles.challengeTitleText, { color: colors.tint }]}>
                      {notification.challenge_title}
                    </Text>
                  </View>
                )}
                
                <Text style={[styles.notificationMessage, { color: colors.icon }]}>
                  {notification.message}
                </Text>
                
                {/* Potential Reward Badge */}
                {notification.potential_reward !== undefined && notification.potential_reward > 0 && (
                  <View style={[styles.rewardBadge, { backgroundColor: '#22c55e20' }]}>
                    <Ionicons size={14} name="trophy" color="#22c55e" />
                    <Text style={[styles.rewardText, { color: '#22c55e' }]}>
                      Win up to ${notification.potential_reward.toFixed(2)}
                    </Text>
                  </View>
                )}
                
                <Text style={[styles.notificationTime, { color: colors.icon }]}>
                  {formatTime(notification.created_at)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowDeleteModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <Ionicons name="trash-outline" size={48} color="#ff4757" />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Delete All Notifications?</Text>
            <Text style={[styles.modalMessage, { color: colors.icon }]}>
              This will permanently delete all your notifications. This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, { borderColor: colors.icon }]} 
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.icon }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.deleteButton]} 
                onPress={confirmDeleteAll}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>Delete All</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 10,
  },
  markAllButton: {
    padding: 5,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  filterTab: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  filterText: {
    fontSize: 16,
    fontWeight: '600',
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  challengeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  challengeTitleText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  rewardText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  notificationTime: {
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 10,
  },
  bottomPadding: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  deleteButton: {
    backgroundColor: '#ff4757',
    borderColor: '#ff4757',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
