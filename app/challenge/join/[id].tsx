import { useState, useEffect } from 'react';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Modal, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';
import { challengesApi, Challenge } from '@/api/challenges';
import { participantsApi } from '@/api/participants';
import { walletApi } from '@/api/wallet';

// Interface for display format (mapped from API)
interface ChallengeDisplay {
  id: string;
  title: string;
  description: string;
  participants: number;
  daysLeft: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: string;
  image: string;
  videoRequirements: string;
  schedule: {
    days: string[];
    time: string;
    repeat: string;
    startTime?: string;
    endTime?: string;
  };
  entryFee: number;
  potentialReward: number;
  currentStake?: number;
  minStake?: number;
  maxStake?: number;
  stakeMultiplier?: number;
}

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

// Map API Challenge to display format
const mapChallengeToDisplay = (challenge: Challenge): ChallengeDisplay => {
  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    participants: challenge.participants_count,
    daysLeft: challenge.days_left,
    difficulty: challenge.difficulty,
    category: challenge.category,
    image: `https://picsum.photos/400/200?random=${challenge.id.charCodeAt(0)}`,
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
    minStake: challenge.min_stake,
    maxStake: challenge.max_stake,
    stakeMultiplier: challenge.stake_multiplier,
  };
};

// Default rules based on category
const getDefaultRules = (category: string): string[] => {
  switch (category) {
    case 'Fitness':
      return [
        'Complete daily workout requirements',
        'Log your progress in the app',
        'Record video proof as required',
        'Maintain consistency throughout the challenge',
      ];
    case 'Sustainability':
      return [
        'Complete daily sustainability tasks',
        'Document your efforts with photos',
        'Share tips with the community',
        'Complete daily check-ins',
      ];
    case 'Education':
      return [
        'Complete daily learning sessions',
        'Track your progress',
        'Take assessments as required',
        'Engage with learning materials',
      ];
    case 'Wellness':
      return [
        'Complete daily wellness activities',
        'Log your sessions',
        'Track your mood and progress',
        'Follow guidelines for the challenge',
      ];
    default:
      return [
        'Complete all daily requirements',
        'Log your progress',
        'Record proof as required',
        'Stay consistent throughout the challenge',
      ];
  }
};

export default function JoinChallengeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, loading: authLoading } = useAuth();
  
const [challenge, setChallenge] = useState<ChallengeDisplay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isAlreadyJoined, setIsAlreadyJoined] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  useEffect(() => {
    const fetchChallenge = async () => {
      if (!id) {
        setError('Invalid challenge ID');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await challengesApi.getById(id);
        
        if (data) {
          setChallenge(mapChallengeToDisplay(data));
          
          // Check if user is already a participant
          if (user?.id) {
            const participating = await participantsApi.isParticipating(id, user.id);
            setIsAlreadyJoined(participating);
            
            // Get wallet balance
            try {
              const balance = await walletApi.getBalance(user.id);
              setWalletBalance(balance || 0);
            } catch (e) {
              // Wallet might not exist yet
              setWalletBalance(0);
            }
          }
        } else {
          setError('Challenge not found');
        }
      } catch (err: any) {
        console.error('Error fetching challenge:', err);
        setError(err.message || 'Failed to load challenge');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchChallenge();
    }
  }, [id, user, authLoading]);

  const handleJoin = async () => {
    if (!agreedToTerms) return;
    if (!user) {
      Alert.alert('Error', 'Please log in to join a challenge');
      return;
    }
    if (!challenge) return;
    
    setIsJoining(true);
    
    try {
      // Check if already participating
      const isParticipating = await participantsApi.isParticipating(challenge.id, user.id);
      if (isParticipating) {
        Alert.alert('Already Joined', 'You are already participating in this challenge');
        setIsJoining(false);
        return;
      }

      // Check wallet balance
      const stakeAmount = challenge.entryFee || 1.00;
      const hasFunds = await walletApi.hasSufficientFunds(user.id, stakeAmount);
      
      if (!hasFunds) {
        Alert.alert(
          'Insufficient Funds', 
          `You need $${stakeAmount.toFixed(2)} to join this challenge. Please add funds to your wallet.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Funds', onPress: () => router.push('/add-funds') }
          ]
        );
        setIsJoining(false);
        return;
      }

      // Deduct from wallet
      await walletApi.deductFunds(user.id, stakeAmount);
      
      // Add participant record
      await participantsApi.join(challenge.id, user.id, stakeAmount);
      
      // Increment challenge participants count
      await challengesApi.incrementParticipants(challenge.id);
      
      // Show success modal
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error('Error joining challenge:', err);
      Alert.alert('Error', err.message || 'Failed to join challenge. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleModalClose = () => {
    setShowSuccessModal(false);
    router.back();
  };

  if (loading || authLoading) {
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

  if (error || !challenge) {
    return (
      <>
        <Stack.Screen 
          options={{ 
            headerShown: true,
            headerTitle: 'Error',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            presentation: 'modal',
          }} 
        />
        <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.icon} />
          <Text style={[styles.errorText, { color: colors.text }]}>{error || 'Challenge not found'}</Text>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: colors.tint }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const rules = getDefaultRules(challenge.category);

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          headerTitle: `Join ${challenge.title}`,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          presentation: 'modal',
        }} 
      />
      <ScrollView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        {/* Challenge Header */}
        <View style={[styles.headerCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
          <Image source={{ uri: challenge.image }} style={styles.challengeImage} />
          <View style={styles.headerContent}>
            <View style={styles.categoryRow}>
              <Text style={styles.categoryIcon}>{getCategoryIcon(challenge.category)}</Text>
              <Text style={[styles.categoryText, { color: colors.icon }]}>{challenge.category}</Text>
            </View>
            <Text style={[styles.challengeTitle, { color: colors.text }]}>{challenge.title}</Text>
            <Text style={[styles.challengeDescription, { color: colors.icon }]}>{challenge.description}</Text>
          </View>
        </View>

        {/* Wallet Balance Warning */}
        {walletBalance < (challenge.entryFee || 1) && (
          <View style={[styles.walletWarning, { backgroundColor: '#ff6b6b20' }]}>
            <Ionicons name="wallet-outline" size={20} color="#ff6b6b" style={styles.warningIcon} />
            <Text style={[styles.walletWarningText, { color: '#ff6b6b' }]}>
              Insufficient funds: ${walletBalance.toFixed(2)} available
            </Text>
            <TouchableOpacity onPress={() => router.push('/add-funds')}>
              <Text style={[styles.addFundsLink, { color: colors.tint }]}>Add Funds</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Entry Amount */}
        <View style={[styles.amountCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
          <Text style={[styles.amountLabel, { color: colors.icon }]}>Entry Fee</Text>
          <Text style={[styles.amountValue, { color: colors.tint }]}>${challenge.entryFee?.toFixed(2)}</Text>
          
          <View style={styles.rewardRow}>
            <View style={styles.rewardItem}>
              <Text style={[styles.rewardLabel, { color: colors.icon }]}>Potential Reward</Text>
              <Text style={[styles.rewardValue, { color: '#2ed573' }]}>${challenge.potentialReward?.toFixed(2)}</Text>
            </View>
            <View style={styles.rewardItem}>
              <Text style={[styles.rewardLabel, { color: colors.icon }]}>Challenge Duration</Text>
              <Text style={[styles.rewardValue, { color: colors.text }]}>{challenge.daysLeft} days</Text>
            </View>
          </View>

          {/* Stake Info */}
          {(challenge.minStake || challenge.maxStake || challenge.currentStake) && (
            <View style={[styles.stakeInfo, { backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#e8e8e8' }]}>
              {challenge.currentStake && challenge.currentStake > 0 && (
                <Text style={[styles.stakeText, { color: '#8e44ad' }]}>
                  Current Stake: ${challenge.currentStake.toFixed(2)}
                </Text>
              )}
              {challenge.minStake && (
                <Text style={[styles.stakeRange, { color: colors.icon }]}>
                  Min: ${challenge.minStake.toFixed(2)} | Max: ${(challenge.maxStake || 100).toFixed(2)}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Schedule & Requirements */}
        <View style={[styles.detailsCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="calendar" size={20} color={colors.text} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Schedule</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={16} color={colors.icon} style={styles.detailIcon} />
            <Text style={[styles.detailLabel, { color: colors.icon }]}>Days:</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {challenge.schedule?.days.join(', ')}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time" size={16} color={colors.icon} style={styles.detailIcon} />
            <Text style={[styles.detailLabel, { color: colors.icon }]}>Time:</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{challenge.schedule?.time}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="repeat" size={16} color={colors.icon} style={styles.detailIcon} />
            <Text style={[styles.detailLabel, { color: colors.icon }]}>Repeat:</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {challenge.schedule?.repeat === 'daily' ? 'Daily' : 'Weekly'}
            </Text>
          </View>
        </View>

        <View style={[styles.detailsCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="videocam" size={20} color={colors.text} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Video Proof Requirements</Text>
          </View>
          <Text style={[styles.videoReqText, { color: colors.icon }]}>
            {challenge.videoRequirements}
          </Text>
        </View>

        <View style={[styles.detailsCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="document-text" size={20} color={colors.text} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Rules</Text>
          </View>
          {rules.map((rule, index) => (
            <View key={index} style={styles.ruleItem}>
              <Ionicons name="checkmark-circle" size={16} color="#FF6B35" style={styles.ruleIcon} />
              <Text style={[styles.ruleText, { color: colors.icon }]}>{rule}</Text>
            </View>
          ))}
        </View>

        {/* Terms Agreement */}
        <View style={[styles.termsCard, { backgroundColor: colors.tint + '15' }]}>
          <TouchableOpacity 
            style={styles.checkboxRow}
            onPress={() => setAgreedToTerms(!agreedToTerms)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, agreedToTerms && { backgroundColor: colors.tint, borderColor: colors.tint }]}>
              {agreedToTerms && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={[styles.termsText, { color: colors.text }]}>
              I understand that my money will be locked until the end of the challenge and there is no refund.
            </Text>
          </TouchableOpacity>
        </View>

        {/* Join Button */}
        <TouchableOpacity 
          style={[
            styles.joinButton, 
            { backgroundColor: (agreedToTerms && !isAlreadyJoined) ? colors.tint : '#ccc' }
          ]}
          onPress={handleJoin}
          disabled={!agreedToTerms || isJoining || isAlreadyJoined}
          activeOpacity={0.8}
        >
          <Text style={styles.joinButtonText}>
            {isJoining 
              ? 'Joining...' 
              : isAlreadyJoined 
                ? 'Already Joined' 
                : `Join Challenge - $${challenge.entryFee?.toFixed(2)}`
            }
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.cancelButton, { borderColor: colors.icon }]}
          onPress={() => router.back()}
          disabled={isJoining}
        >
          <Text style={[styles.cancelButtonText, { color: colors.icon }]}>Cancel</Text>
        </TouchableOpacity>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>

      {/* Success Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSuccessModal}
        onRequestClose={handleModalClose}
      >
        <Pressable style={styles.modalOverlay} onPress={handleModalClose}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={80} color="#2ed573" />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>🎉 Challenge Joined!</Text>
            <Text style={[styles.modalMessage, { color: colors.icon }]}>
              You've successfully joined {challenge.title}! Good luck on your journey!
            </Text>
            <View style={[styles.modalDetails, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
              <View style={styles.modalDetailRow}>
                <Text style={[styles.modalDetailLabel, { color: colors.icon }]}>Entry Fee</Text>
                <Text style={[styles.modalDetailValue, { color: colors.tint }]}>${challenge.entryFee?.toFixed(2)}</Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={[styles.modalDetailLabel, { color: colors.icon }]}>Duration</Text>
                <Text style={[styles.modalDetailValue, { color: colors.text }]}>{challenge.daysLeft} days</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: colors.tint }]}
              onPress={handleModalClose}
            >
              <Text style={styles.modalButtonText}>Go to Challenges</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  headerCard: {
    borderRadius: 16,
    marginTop: 20,
    overflow: 'hidden',
  },
  challengeImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  headerContent: {
    padding: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 14,
  },
  challengeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  challengeDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  walletWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  warningIcon: {
    marginRight: 8,
  },
  walletWarningText: {
    flex: 1,
    fontSize: 14,
  },
  addFundsLink: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  amountCard: {
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  rewardRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
  },
  rewardItem: {
    alignItems: 'center',
  },
  rewardLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  rewardValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  stakeInfo: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  stakeText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  stakeRange: {
    fontSize: 12,
  },
  detailsCard: {
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailIcon: {
    marginRight: 8,
  },
  detailLabel: {
    fontSize: 14,
    width: 70,
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
  },
  videoReqText: {
    fontSize: 14,
    lineHeight: 20,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ruleIcon: {
    marginRight: 10,
  },
  ruleText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  termsCard: {
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 22,
  },
  joinButton: {
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 24,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 20,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  successIconContainer: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalDetails: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalDetailLabel: {
    fontSize: 14,
  },
  modalDetailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
