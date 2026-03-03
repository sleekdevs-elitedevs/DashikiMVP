import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useState, useEffect, useCallback } from 'react';
import { profilesApi } from '@/api/profiles';
import { walletApi } from '@/api/wallet';
import { participantsApi, Participant } from '@/api/participants';
import { challengesApi, Challenge } from '@/api/challenges';
import { 
  calculateUserPoints, 
  getBadgeForPoints, 
  PointsBreakdown,
  ParticipantWithChallenge 
} from '@/lib/points';

interface UserProfileData {
  id: string;
  username: string;
  avatar: string;
  points: number;
  totalEarned: string;
  challenges: number;
  streak: number;
  badge: string;
  joinedDate: string;
  challengeList: {
    id: string;
    title: string;
    status: string;
    reward: string;
  }[];
  pointsBreakdown?: PointsBreakdown;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { id } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch profile data
      const profile = await profilesApi.getById(id as string);
      
      if (!profile) {
        setError('User not found');
        setLoading(false);
        return;
      }

      // Fetch wallet data
      let walletData = null;
      try {
        walletData = await walletApi.getByUserId(id as string);
      } catch (e) {
        console.log('Wallet not found for user');
      }

      // Fetch user's challenge participations
      const participants = await participantsApi.getByUser(id as string);
      
      // Get unique challenge IDs
      const challengeIds = [...new Set(participants.map((p: Participant) => p.challenge_id))];
      
      // Fetch challenge details
      const challengesMap: Record<string, Challenge> = {};
      for (const challengeId of challengeIds) {
        try {
          const challenge = await challengesApi.getById(challengeId);
          if (challenge) {
            challengesMap[challengeId] = challenge;
          }
        } catch (e) {
          console.log('Challenge not found:', challengeId);
        }
      }

      // Build participant with challenge data for points calculation
      const participantsWithChallenges: ParticipantWithChallenge[] = participants.map(
        (participant: Participant) => ({
          ...participant,
          challenge: challengesMap[participant.challenge_id],
        })
      );

      // Calculate comprehensive points using the new algorithm
      const pointsBreakdown = calculateUserPoints(participantsWithChallenges);

      // Build challenge list with status
      const challengeList = participants.map((participant: Participant) => {
        const challenge = challengesMap[participant.challenge_id];
        let status = 'In Progress';
        if (participant.status === 'completed') {
          status = 'Completed';
        } else if (participant.status === 'dropped') {
          status = 'Dropped';
        }
        
        return {
          id: participant.challenge_id,
          title: challenge?.title || 'Unknown Challenge',
          status: status,
          reward: challenge ? `$${challenge.potential_reward}` : '$0',
        };
      });

      // Format joined date
      const joinedDate = profile.created_at 
        ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'Unknown';

      // Get badge based on points
      const badge = getBadgeForPoints(pointsBreakdown.totalPoints);

      setUser({
        id: profile.id,
        username: profile.username,
        avatar: profile.avatar_url || 'https://i.pravatar.cc/150?img=1',
        points: pointsBreakdown.totalPoints,
        totalEarned: walletData ? `$${walletData.total_earned.toFixed(2)}` : '$0.00',
        challenges: pointsBreakdown.totalChallenges,
        streak: pointsBreakdown.currentStreak,
        badge: badge,
        joinedDate: joinedDate,
        challengeList: challengeList,
        pointsBreakdown: pointsBreakdown,
      });
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return '#34C759';
      case 'In Progress':
        return '#007AFF';
      default:
        return '#8E8E93';
    }
  };

  const handleChallengePress = (challengeId: string) => {
    router.push({ pathname: '/challenge/[id]', params: { id: challengeId } });
  };

  // Show loading state
  if (loading) {
    return (
      <>
        <Stack.Screen 
          options={{ 
            headerShown: true,
            headerTitle: 'Profile',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            presentation: 'modal',
          }} 
        />
        <View style={[styles.container, styles.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading profile...</Text>
        </View>
      </>
    );
  }

  // Show error state
  if (error || !user) {
    return (
      <>
        <Stack.Screen 
          options={{ 
            headerShown: true,
            headerTitle: 'Profile',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            presentation: 'modal',
          }} 
        />
        <View style={[styles.container, styles.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          <Text style={[styles.errorText, { color: '#FF3B30' }]}>{error || 'Failed to load profile'}</Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: colors.tint }]}
            onPress={() => fetchUserData()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          headerTitle: 'Profile',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          presentation: 'modal',
        }} 
      />
      <ScrollView 
        style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
      >
        {/* Profile Header */}
        <View style={[styles.profileHeader, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
            <Text style={styles.badge}>{user.badge}</Text>
          </View>
          
          <Text style={[styles.username, { color: colors.text }]}>{user.username}</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.tint }]}>{user.points.toLocaleString()}</Text>
              <Text style={[styles.statLabel, { color: colors.icon }]}>Points</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#34C759' }]}>{user.totalEarned}</Text>
              <Text style={[styles.statLabel, { color: colors.icon }]}>Total Earned</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{user.challenges}</Text>
              <Text style={[styles.statLabel, { color: colors.icon }]}>Challenges</Text>
            </View>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={[styles.infoText, { color: colors.icon }]}>🔥 {user.streak} day streak</Text>
            <Text style={[styles.infoText, { color: colors.icon }]}>📅 Joined {user.joinedDate}</Text>
          </View>
        </View>

        {/* Points Breakdown Section */}
        {user.pointsBreakdown && (
          <View style={[styles.pointsBreakdown, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Points Breakdown</Text>
            
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.icon }]}>🏆 Won Challenges:</Text>
              <Text style={[styles.breakdownValue, { color: '#34C759' }]}>{user.pointsBreakdown.wonChallenges}</Text>
            </View>
            
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.icon }]}>✅ Completed:</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>{user.pointsBreakdown.completedChallenges}</Text>
            </View>
            
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.icon }]}>❌ Dropped:</Text>
              <Text style={[styles.breakdownValue, { color: '#FF3B30' }]}>{user.pointsBreakdown.droppedChallenges}</Text>
            </View>
            
            <View style={styles.breakdownDivider} />
            
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.icon }]}>Completion Points:</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>+{user.pointsBreakdown.completionPoints}</Text>
            </View>
            
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.icon }]}>Victory Points:</Text>
              <Text style={[styles.breakdownValue, { color: '#34C759' }]}>+{user.pointsBreakdown.victoryPoints}</Text>
            </View>
            
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.icon }]}>Stake Bonus:</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>+{user.pointsBreakdown.stakeBonusPoints}</Text>
            </View>
            
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.icon }]}>Streak Bonus:</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>+{user.pointsBreakdown.streakBonusPoints}</Text>
            </View>
            
            {user.pointsBreakdown.penaltyPoints > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: colors.icon }]}>Penalties:</Text>
                <Text style={[styles.breakdownValue, { color: '#FF3B30' }]}>-{user.pointsBreakdown.penaltyPoints}</Text>
              </View>
            )}
          </View>
        )}

        {/* Challenges Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Challenge History</Text>
          
          {user.challengeList.length > 0 ? (
            user.challengeList.map((challenge) => (
              <TouchableOpacity
                key={challenge.id}
                style={[styles.challengeItem, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}
                onPress={() => handleChallengePress(challenge.id)}
              >
                <View style={styles.challengeInfo}>
                  <Text style={[styles.challengeTitle, { color: colors.text }]}>{challenge.title}</Text>
                  <View style={styles.challengeMeta}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(challenge.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(challenge.status) }]}>{challenge.status}</Text>
                    </View>
                    <Text style={[styles.rewardText, { color: '#34C759' }]}>{challenge.reward}</Text>
                  </View>
                </View>
                <Text style={[styles.arrow, { color: colors.icon }]}>›</Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, { color: colors.icon }]}>No challenges yet</Text>
            </View>
          )}
        </View>

        {/* Close Button */}
        <TouchableOpacity 
          style={[styles.closeButton, { backgroundColor: colors.tint }]}
          onPress={() => router.back()}
        >
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  profileHeader: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    fontSize: 32,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#ccc',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  infoText: {
    fontSize: 14,
  },
  pointsBreakdown: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 14,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#ccc',
    marginVertical: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  challengeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  challengeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  rewardText: {
    fontSize: 14,
    fontWeight: '600',
  },
  arrow: {
    fontSize: 24,
    marginLeft: 12,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
  },
  closeButton: {
    padding: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
