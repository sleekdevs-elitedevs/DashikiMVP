import { useLocalSearchParams, Stack, router } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { challengesApi, Challenge } from '@/api/challenges';
import { profilesApi } from '@/api/profiles';
import { participantsApi } from '@/api/participants';
import { proofsApi } from '@/api/proofs';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'Hard':
      return '#ff4757';
    case 'Medium':
      return '#ffa502';
    case 'Easy':
      return '#2ed573';
    default:
      return '#747d8c';
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Fitness':
      return '💪';
    case 'Sustainability':
      return '🌱';
    case 'Education':
      return '📚';
    case 'Wellness':
      return '🧘';
    default:
      return '🎯';
  }
};

const getSettlementStatusColor = (status?: string) => {
  switch (status) {
    case 'settled':
      return '#2ed573';
    case 'processing':
      return '#ffa502';
    case 'cancelled':
      return '#ff4757';
    default:
      return '#747d8c';
  }
};

// Format countdown from days (can be fractional for hours/minutes)
const formatCountdown = (daysLeft: number): { value: string; unit: string; isUrgent: boolean } => {
  if (daysLeft <= 0) {
    return { value: '0', unit: 'Completed', isUrgent: false };
  }
  
  if (daysLeft >= 1) {
    const days = Math.floor(daysLeft);
    return { value: days.toString(), unit: days === 1 ? 'Day' : 'Days', isUrgent: days <= 1 };
  }
  
  // Less than 1 day - show hours
  const hours = daysLeft * 24;
  if (hours >= 1) {
    return { value: Math.floor(hours).toString(), unit: 'Hours', isUrgent: hours < 2 };
  }
  
  // Less than 1 hour - show minutes
  const minutes = hours * 60;
  if (minutes >= 1) {
    return { value: Math.floor(minutes).toString(), unit: 'Mins', isUrgent: true };
  }
  
  // Less than 1 minute - show seconds
  const seconds = minutes * 60;
  return { value: Math.floor(seconds).toString(), unit: 'Secs', isUrgent: true };
};

// Map API Challenge to display format with stakes
const mapChallengeToDisplay = (challenge: Challenge) => {
  return {
    title: challenge.title,
    description: challenge.description,
    participants: challenge.participants_count,
    daysLeft: challenge.days_left,
    difficulty: challenge.difficulty,
    category: challenge.category,
    // Use thumbnail if available, otherwise fall back to placeholder
    image: challenge.thumbnail_url || 'https://picsum.photos/400/200?random=' + Math.floor(Math.random() * 100),
    videoRequirements: challenge.video_requirements || 'No video requirements specified.',
    schedule: {
      days: challenge.schedule_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      time: challenge.schedule_time || '00:00',
      repeat: challenge.schedule_repeat || 'daily',
      startTime: challenge.schedule_start_time || undefined,
      endTime: challenge.schedule_end_time || undefined,
    },
    entryFee: challenge.entry_fee,
    potentialReward: challenge.potential_reward,
    // Stake-related fields
    currentStake: challenge.current_stake,
    totalPool: challenge.total_pool,
    settlementStatus: challenge.settlement_status,
    winnersCount: challenge.winners_count,
    losersCount: challenge.losers_count,
    minStake: challenge.min_stake,
    maxStake: challenge.max_stake,
    stakeMultiplier: challenge.stake_multiplier,
    // Creator info
    creatorId: challenge.creator_id,
  };
};

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [challenge, setChallenge] = useState<any>(null);
  const [creatorName, setCreatorName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isParticipating, setIsParticipating] = useState(false);
  const [hasSubmittedProof, setHasSubmittedProof] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [hasActiveCall, setHasActiveCall] = useState(false);
  const [countdown, setCountdown] = useState<{ value: string; unit: string; isUrgent: boolean } | null>(null);

  useEffect(() => {
    const fetchChallenge = async () => {
      try {
        const data = await challengesApi.getById(id || '');
        if (data) {
          const mappedChallenge = mapChallengeToDisplay(data);
          setChallenge(mappedChallenge);
          
          // Initialize countdown
          if (mappedChallenge.daysLeft !== undefined) {
            setCountdown(formatCountdown(mappedChallenge.daysLeft));
          }
          
          // Fetch creator name if available
          if (data.creator_id) {
            try {
              const creator = await profilesApi.getById(data.creator_id);
              if (creator) {
                setCreatorName(creator.username);
              }
            } catch (error) {
              console.error('Error fetching creator:', error);
            }
          }

          // Check if current user is participating
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            setCurrentUserId(user.id);
            
            // Check if user is the creator
            if (data.creator_id === user.id) {
              setIsCreator(true);
            }
            
            try {
              const isPart = await participantsApi.isParticipating(id || '', user.id);
              setIsParticipating(isPart);
              
              // If participating, check if proof has been submitted
              if (isPart) {
                const participants = await participantsApi.getByUser(user.id);
                const participant = participants.find((p: any) => p.challenge_id === id);
                if (participant) {
                  const proofs = await proofsApi.getByParticipant(participant.id);
                  setHasSubmittedProof(proofs.length > 0);
                }
              }
            } catch (error) {
              console.error('Error checking participation:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching challenge:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchChallenge();
    }
  }, [id]);

  // Update countdown every second
  useEffect(() => {
    if (!challenge?.daysLeft) return;

    // Update countdown immediately
    if (challenge?.daysLeft) {
      setCountdown(formatCountdown(challenge.daysLeft));
    }

    // Then update every second
    const interval = setInterval(() => {
      if (challenge?.daysLeft) {
        setCountdown(formatCountdown(challenge.daysLeft));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [challenge?.daysLeft]);

  if (loading || !challenge) {
    return (
      <>
        <Stack.Screen 
          options={{ 
            headerShown: true,
            headerTitle: 'Loading...',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            presentation: 'modal',
          }} 
        />
        <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          headerTitle: challenge.title,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          presentation: 'modal',
        }} 
      />
      <ScrollView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        {/* Header Image */}
        <Image source={{ uri: challenge.image }} style={styles.headerImage} />
        
        {/* Category & Title */}
        <View style={styles.content}>
          <View style={styles.categoryRow}>
            <Text style={styles.categoryIcon}>{getCategoryIcon(challenge.category)}</Text>
            <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(challenge.difficulty) + '20' }]}>
              <Text style={[styles.difficultyText, { color: getDifficultyColor(challenge.difficulty) }]}>
                {challenge.difficulty}
              </Text>
            </View>
            {isCreator && (
              <View style={[styles.creatorBadge, { backgroundColor: '#8e44ad' + '20' }]}>
                <Text style={[styles.creatorBadgeText, { color: '#8e44ad' }]}>Creator</Text>
              </View>
            )}
          </View>
          
          <Text style={[styles.title, { color: colors.text }]}>{challenge.title}</Text>
          <Text style={[styles.description, { color: colors.icon }]}>{challenge.description}</Text>
          
          {creatorName && (
            <Text style={[styles.creatorText, { color: colors.icon }]}>Created by @{creatorName}</Text>
          )}
          
          {/* Stats */}
          <View style={[styles.statsContainer, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{challenge.participants.toLocaleString()}</Text>
              <Text style={[styles.statLabel, { color: colors.icon }]}>Participants</Text>
            </View>
            <View style={styles.statDivider} />
            
            {/* Countdown Timer */}
            <View style={styles.statItem}>
              {countdown ? (
                <View style={styles.countdownContainer}>
                  <Text style={[
                    styles.countdownValue, 
                    { color: countdown.isUrgent ? '#ff4757' : colors.text }
                  ]}>
                    {countdown.value}
                  </Text>
                  <Text style={[
                    styles.countdownUnit, 
                    { color: countdown.isUrgent ? '#ff4757' : colors.icon }
                  ]}>
                    {countdown.unit}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.statValue, { color: colors.text }]}>{challenge.daysLeft}</Text>
              )}
              <Text style={[styles.statLabel, { color: colors.icon }]}>Time Left</Text>
            </View>
          </View>

          {/* Entry Fee, Reward & Stake Info */}
          <View style={[styles.rewardInfoContainer, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
            <View style={styles.rewardInfoItem}>
              <Text style={[styles.rewardInfoLabel, { color: colors.icon }]}>Entry Fee</Text>
              <Text style={[styles.rewardInfoValue, { color: '#4e73df' }]}>${challenge.entryFee?.toFixed(2)}</Text>
            </View>
            <View style={styles.rewardInfoDivider} />
            
            {/* Current Stake */}
            {challenge.currentStake && challenge.currentStake > 0 ? (
              <View style={styles.rewardInfoItem}>
                <View style={styles.stakeLabelRow}>
                  <Ionicons name="cash" size={14} color="#8e44ad" style={styles.stakeIcon} />
                  <Text style={[styles.rewardInfoLabel, { color: colors.icon }]}>Current Stake</Text>
                </View>
                <Text style={[styles.rewardInfoValue, { color: '#8e44ad' }]}>${challenge.currentStake.toFixed(2)}</Text>
              </View>
            ) : (
              <View style={styles.rewardInfoItem}>
                <Text style={[styles.rewardInfoLabel, { color: colors.icon }]}>Stake</Text>
                <Text style={[styles.rewardInfoValue, { color: '#8e44ad' }]}>$1.00 (default)</Text>
              </View>
            )}
            
            <View style={styles.rewardInfoDivider} />
            <View style={styles.rewardInfoItem}>
              <Text style={[styles.rewardInfoLabel, { color: colors.icon }]}>Potential Reward</Text>
              <Text style={[styles.rewardInfoValue, { color: '#2ed573' }]}>${challenge.potentialReward?.toFixed(2)}</Text>
            </View>
          </View>

          {/* Total Pool & Settlement Status (if available) */}
          {(challenge.totalPool || challenge.settlementStatus) && (
            <View style={[styles.poolContainer, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
              {challenge.totalPool && challenge.totalPool > 0 && (
                <View style={styles.poolItem}>
                  <View style={styles.poolLabelRow}>
                    <Ionicons name="trophy" size={16} color="#ffa502" style={styles.poolIcon} />
                    <Text style={[styles.poolLabel, { color: colors.icon }]}>Total Pool</Text>
                  </View>
                  <Text style={[styles.poolValue, { color: '#ffa502' }]}>${challenge.totalPool.toFixed(2)}</Text>
                </View>
              )}
              
              {challenge.settlementStatus && challenge.settlementStatus !== 'pending' && (
                <View style={[styles.statusBadge, { backgroundColor: getSettlementStatusColor(challenge.settlementStatus) + '20' }]}>
                  <Text style={[styles.statusText, { color: getSettlementStatusColor(challenge.settlementStatus) }]}>
                    {challenge.settlementStatus === 'settled' && (
                      <Text>🏆 Settlement Complete - {challenge.winnersCount || 0} winners</Text>
                    )}
                    {challenge.settlementStatus === 'processing' && (
                      <Text>⏳ Settlement Processing...</Text>
                    )}
                    {challenge.settlementStatus === 'cancelled' && (
                      <Text>❌ Challenge Cancelled</Text>
                    )}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Stake Calculation Info */}
          {(challenge.minStake || challenge.maxStake || challenge.stakeMultiplier) && (
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="calculator" size={20} color={colors.text} style={styles.sectionIcon} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Stake Information</Text>
            </View>
          )}
          {(challenge.minStake || challenge.maxStake || challenge.stakeMultiplier) && (
            <View style={[styles.listContainer, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
              {challenge.minStake && (
                <View style={styles.listItem}>
                  <Ionicons name="arrow-down" size={16} color="#2ed573" style={styles.listIcon} />
                  <Text style={[styles.listText, { color: colors.icon }]}>
                    Minimum Stake: ${challenge.minStake.toFixed(2)}
                  </Text>
                </View>
              )}
              {challenge.maxStake && (
                <View style={styles.listItem}>
                  <Ionicons name="arrow-up" size={16} color="#ff4757" style={styles.listIcon} />
                  <Text style={[styles.listText, { color: colors.icon }]}>
                    Maximum Stake: ${challenge.maxStake.toFixed(2)}
                  </Text>
                </View>
              )}
              {challenge.stakeMultiplier && (
                <View style={styles.listItem}>
                  <Ionicons name="trending-up" size={16} color="#8e44ad" style={styles.listIcon} />
                  <Text style={[styles.listText, { color: colors.icon }]}>
                    Difficulty Multiplier: {challenge.stakeMultiplier.toFixed(2)}x
                  </Text>
                </View>
              )}
              <View style={styles.listItem}>
                <Ionicons name="people" size={16} color={colors.icon} style={styles.listIcon} />
                <Text style={[styles.listText, { color: colors.icon }]}>
                  Participant Bonus: +5% per participant
                </Text>
              </View>
              <View style={styles.listItem}>
                <Ionicons name="business" size={16} color={colors.icon} style={styles.listIcon} />
                <Text style={[styles.listText, { color: colors.icon }]}>
                  Platform Fee: 10%
                </Text>
              </View>
            </View>
          )}

          {/* Schedule */}
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="calendar" size={20} color={colors.text} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Schedule</Text>
          </View>
          <View style={[styles.listContainer, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
            <View style={styles.listItem}>
              <Ionicons name="time-outline" size={18} color={colors.icon} style={styles.listIcon} />
              <Text style={[styles.listText, { color: colors.icon }]}>
                {challenge.schedule?.days.join(', ')} at {challenge.schedule?.time}
              </Text>
            </View>
            {(challenge.schedule?.startTime || challenge.schedule?.endTime) && (
              <View style={styles.listItem}>
                <Ionicons name="timer-outline" size={18} color={colors.icon} style={styles.listIcon} />
                <Text style={[styles.listText, { color: colors.icon }]}>
                  {challenge.schedule?.startTime || 'N/A'} - {challenge.schedule?.endTime || 'N/A'}
                </Text>
              </View>
            )}
            <View style={styles.listItem}>
              <Ionicons name="repeat" size={18} color={colors.icon} style={styles.listIcon} />
              <Text style={[styles.listText, { color: colors.icon }]}>
                {challenge.schedule?.repeat === 'daily' ? 'Daily' : 'Weekly'} repetition
              </Text>
            </View>
          </View>

          {/* Video Requirements */}
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="videocam" size={20} color={colors.text} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Video Proof Requirements</Text>
          </View>
          <View style={[styles.listContainer, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
            <Text style={[styles.videoReqText, { color: colors.icon }]}>
              {challenge.videoRequirements}
            </Text>
          </View>
          
          {/* Action Buttons - Different for Creator vs Participant */}
          
          {/* PARTICIPANT: Can submit proof */}
          {!isCreator && isParticipating && !hasSubmittedProof && (
            <TouchableOpacity 
              style={[styles.joinButton, { backgroundColor: colors.tint }]}
              onPress={() => router.push({ pathname: '/challenge/submit-proof/[id]', params: { id: id?.toString() || '1' } })}
            >
              <Ionicons name="cloud-upload" size={20} color="#fff" />
              <Text style={styles.joinButtonText}>
                Submit Proof
              </Text>
            </TouchableOpacity>
          )}
          
          {/* PARTICIPANT: Already submitted proof */}
          {isParticipating && hasSubmittedProof && (
            <TouchableOpacity 
              style={[styles.joinButton, { backgroundColor: colors.tint }]}
              disabled={true}
            >
              <Text style={styles.joinButtonText}>
                Settlement in Progress
              </Text>
            </TouchableOpacity>
          )}
          
          {/* NOT PARTICIPATING: Join challenge button */}
          {!isParticipating && !isCreator && (
            <TouchableOpacity 
              style={[styles.joinButton, { backgroundColor: colors.tint }]}
              onPress={() => router.push({ pathname: '/challenge/join/[id]', params: { id: id?.toString() || '1' } })}
            >
              <Text style={styles.joinButtonText}>
                Join Challenge {challenge.currentStake ? `- $${challenge.currentStake.toFixed(2)}` : ''}
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={[styles.closeButton, { borderColor: colors.icon }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.closeButtonText, { color: colors.icon }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  content: {
    paddingBottom: 50,
    paddingRight: 20,
    paddingLeft: 20,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  categoryIcon: {
    fontSize: 32,
    marginRight: 4,
  },
  difficultyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  creatorBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 4,
  },
  creatorBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 10,
  },
  creatorText: {
    fontSize: 14,
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#ddd',
    marginHorizontal: 20,
  },
  countdownContainer: {
    alignItems: 'center',
  },
  countdownValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  countdownUnit: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIcon: {
    marginRight: 8,
  },
  listContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  listIcon: {
    marginRight: 10,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  joinButton: {
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    borderWidth: 1,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  rewardInfoContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  rewardInfoItem: {
    flex: 1,
    alignItems: 'center',
  },
  rewardInfoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  rewardInfoValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  rewardInfoDivider: {
    width: 1,
    backgroundColor: '#ddd',
    marginHorizontal: 10,
  },
  stakeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  stakeIcon: {
    marginRight: 4,
  },
  poolContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  poolItem: {
    alignItems: 'center',
    marginBottom: 12,
  },
  poolLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  poolIcon: {
    marginRight: 6,
  },
  poolLabel: {
    fontSize: 14,
  },
  poolValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  videoReqText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
