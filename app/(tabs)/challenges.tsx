import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import ChallengeCard, { FullChallenge } from '@/components/challenge-card';
import { challengesApi, Challenge } from '@/api/challenges';
import { profilesApi } from '@/api/profiles';
import { participantsApi } from '@/api/participants';
import { useAuth } from '@/hooks/useAuth';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';

type ChallengeStatus = 'Active' | 'Upcoming' | 'Completed' | 'Past' | 'MyUploads';

const STATUS_FILTERS: ChallengeStatus[] = ['Active', 'Upcoming', 'Completed', 'Past', 'MyUploads'];

// Map API Challenge to FullChallenge for the component
const mapChallengeToFullChallenge = async (challenge: Challenge, userId?: string): Promise<FullChallenge> => {
  let createdBy: { id: string | number; username: string; avatar?: string } | undefined;
  
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

  // Check if current user is a winner (for past challenges)
  let isWinner = false;
  let payoutAmount = 0;
  if (userId && challenge.settlement_status === 'settled') {
    try {
      const participations = await participantsApi.getByUser(userId);
      const participation = participations.find(p => p.challenge_id === challenge.id);
      if (participation) {
        isWinner = participation.is_winner || false;
        payoutAmount = participation.payout_amount || 0;
      }
    } catch (error) {
      console.error('Error fetching participation:', error);
    }
  }

  return {
    id: 1,
    uuid: challenge.id,
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
    currentStake: challenge.current_stake,
    totalPool: challenge.total_pool,
    settlementStatus: challenge.settlement_status,
    winnersCount: challenge.winners_count,
    createdBy,
    // For past challenges
    isWinner,
    payoutAmount,
  };
};

export default function ChallengesScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const theme = Colors[colorScheme ?? 'light'];
  
  // Redirect to login if not authenticated
  useAuthRedirect();
  
  const { user, loading: authLoading } = useAuth();
  
  const [selectedStatus, setSelectedStatus] = useState<ChallengeStatus>('Active');
  const [challenges, setChallenges] = useState<FullChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<FullChallenge | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch challenges based on selected status
  const fetchChallenges = useCallback(async (isRefresh = false) => {
    if (!user) {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
      return;
    }

    try {
      if (!isRefresh) {
        setLoading(true);
      }
      
      let fetchedChallenges: Challenge[] = [];

      if (selectedStatus === 'Past') {
        // Get past challenges the user participated in
        fetchedChallenges = await challengesApi.getPastChallengesByUser(user.id);
      } else if (selectedStatus === 'MyUploads') {
        // Get challenges created by the current user
        const allChallenges = await challengesApi.getAll();
        fetchedChallenges = allChallenges.filter(c => c.creator_id === user.id);
      } else {
        // Get all participations for the current user
        const participations = await participantsApi.getByUser(user.id);
        
        if (!participations || participations.length === 0) {
          setChallenges([]);
          setLoading(false);
          if (isRefresh) setRefreshing(false);
          return;
        }

        // Filter by status
        const filteredParticipations = participations.filter(
          p => selectedStatus === 'Completed' 
            ? p.status === 'completed' 
            : p.status === 'joined'
        );
        
        // Get unique challenge IDs
        const challengeIds = [...new Set(filteredParticipations.map(p => p.challenge_id))];
        
        // Fetch all challenges
        const allChallenges = await challengesApi.getAll();
        
        // Filter challenges that match the user's participation status and selected status
        fetchedChallenges = allChallenges.filter(c => 
          challengeIds.includes(c.id) && c.status === selectedStatus
        );
      }
      
      // Map to FullChallenge format
      const mappedChallenges = await Promise.all(
        fetchedChallenges.map(challenge => mapChallengeToFullChallenge(challenge, user.id))
      );
      
      setChallenges(mappedChallenges);
    } catch (error) {
      console.error('Error fetching challenges:', error);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, [user?.id, selectedStatus]);

  // Handle pull-to-refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchChallenges(true);
  }, [fetchChallenges]);

  useEffect(() => {
    if (!authLoading) {
      fetchChallenges();
    }
  }, [authLoading, fetchChallenges]);

  const handleChallengePress = (challenge: FullChallenge) => {
    const challengeId = challenge.uuid || challenge.id.toString();
    router.push({ pathname: '/challenge/[id]', params: { id: challengeId } });
  };

  const handleCreatorPress = (creatorId: string | number) => {
    router.push({ pathname: '/profile/[id]', params: { id: creatorId.toString() } });
  };

  const getStatusLabel = (status: ChallengeStatus): string => {
    switch (status) {
      case 'Active': return 'Active';
      case 'Upcoming': return 'Upcoming';
      case 'Completed': return 'Completed';
      case 'Past': return 'Past Events';
      case 'MyUploads': return 'My Uploads';
      default: return status;
    }
  };

  // Handle delete challenge
  const handleDeletePress = (challenge: FullChallenge) => {
    setSelectedChallenge(challenge);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!selectedChallenge) return;
    
    try {
      setIsDeleting(true);
      const challengeId = selectedChallenge.uuid || selectedChallenge.id.toString();
      await challengesApi.delete(challengeId);
      setChallenges(prev => prev.filter(c => (c.uuid || c.id.toString()) !== challengeId));
      setDeleteModalVisible(false);
      setSelectedChallenge(null);
    } catch (error) {
      console.error('Error deleting challenge:', error);
      Alert.alert('Error', 'Failed to delete challenge. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Check if challenge can be deleted (no participants and has ended)
  const canDeleteChallenge = (challenge: FullChallenge): boolean => {
    const isEnded = challenge.status === 'Completed' || challenge.settlementStatus === 'settled' || challenge.settlementStatus === 'cancelled';
    const hasNoParticipants = challenge.participants === 0;
    return isEnded && hasNoParticipants;
  };

  if (loading || authLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <StatusBar
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>My Challenges</Text>
        <Text style={[styles.subtitle, { color: theme.icon }]}>
          {selectedStatus === 'Past' 
            ? 'Your challenge history' 
            : selectedStatus === 'MyUploads'
            ? 'Challenges you created'
            : "Challenges you've joined"}
        </Text>
      </View>

      {/* Status Filters - fixed at top */}
      <View style={styles.categoryWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryContainer}
        >
          {STATUS_FILTERS.map((status) => {
            const isActive = selectedStatus === status;
            return (
              <TouchableOpacity
                key={status}
                onPress={() => setSelectedStatus(status)}
                style={[
                  styles.categoryButton,
                  {
                    backgroundColor: isActive
                      ? theme.tint
                      : colorScheme === 'dark'
                      ? '#333'
                      : '#f0f0f0',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    { color: isActive ? '#fff' : theme.text },
                  ]}
                >
                  {getStatusLabel(status)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Challenge List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.challengeList,
          { paddingBottom: insets.bottom + 20 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.tint}
            colors={[theme.tint]}
          />
        }
      >
        {challenges.length > 0 ? (
          challenges.map((challenge) => (
            <ChallengeCard
              key={challenge.uuid || challenge.id}
              challenge={challenge}
              onPress={() => handleChallengePress(challenge)}
              onCreatorPress={handleCreatorPress}
              onDelete={selectedStatus === 'MyUploads' && canDeleteChallenge(challenge) ? () => handleDeletePress(challenge) : undefined}
            />
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.icon }]}>
              {selectedStatus === 'Past' 
                ? 'No past events yet.' 
                : selectedStatus === 'MyUploads'
                ? 'No uploads yet.'
                : `No ${selectedStatus.toLowerCase()} challenges yet.`}
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.icon }]}>
              {selectedStatus === 'Active' 
                ? 'Join a challenge to get started!'
                : selectedStatus === 'MyUploads'
                ? 'Create a challenge to get started!'
                : selectedStatus === 'Completed' || selectedStatus === 'Past'
                ? 'Complete challenges to see them here.'
                : 'Check back later for upcoming challenges.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDeleteModalVisible(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.background }]} onPress={() => {}}>
            <Ionicons name="trash-outline" size={48} color="#ff4757" />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Delete Challenge?</Text>
            <Text style={[styles.modalMessage, { color: theme.icon }]}>
              This will permanently delete "{selectedChallenge?.title}". This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, { borderColor: theme.icon }]} 
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.icon }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.deleteButton]} 
                onPress={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>Delete</Text>
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  categoryWrapper: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  categoryContainer: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  categoryButton: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  challengeList: {
    paddingHorizontal: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    textAlign: 'center',
    fontSize: 14,
    marginTop: 8,
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
