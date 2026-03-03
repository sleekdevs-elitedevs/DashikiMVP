import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { useColorScheme } from '../hooks/use-color-scheme';

// Schedule types matching the upload screen
export type RepeatOption = 'single' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface ChallengeSchedule {
  days: string[];
  time: string;
  repeat: RepeatOption;
  startTime?: string;
  endTime?: string;
}

export interface Challenge {
  id: number;
  uuid?: string; // Original UUID from database
  title: string;
  description: string;
  participants: number;
  daysLeft: number;
  difficulty: string;
  category: string;
  status?: 'Active' | 'Upcoming' | 'Completed';
  // Fields from upload screen
  videoRequirements?: string;
  schedule?: ChallengeSchedule;
  entryFee?: number;
  potentialReward?: number;
  // User participation status
  isJoined?: boolean;
  // Stake-related fields
  currentStake?: number;
  totalPool?: number;
  settlementStatus?: 'pending' | 'processing' | 'settled' | 'cancelled';
  winnersCount?: number;
  // For past challenges - user's result
  isWinner?: boolean;
  payoutAmount?: number;
}

interface Creator {
  id: string | number;
  username: string;
  avatar?: string;
}

export type FullChallenge = Challenge & {
  createdBy?: Creator;
};

interface ChallengeCardProps {
  challenge: FullChallenge;
  onCreatorPress?: (creatorId: string | number) => void;
  onJoin?: () => void;
  onPress?: () => void;
  onDelete?: () => void;
}

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

const getRepeatLabel = (repeat: RepeatOption): string => {
  switch (repeat) {
    case 'single':
      return 'Single-time';
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'biweekly':
      return 'Bi-weekly';
    case 'monthly':
      return 'Monthly';
    default:
      return '';
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

export default function ChallengeCard({
  challenge,
  onJoin,
  onPress,
  onCreatorPress,
  onDelete,
}: ChallengeCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleCreatorPress = () => {
    if (challenge.createdBy && onCreatorPress) {
      onCreatorPress(challenge.createdBy.id);
    }
  };

  // Check if this is a past challenge with user results
  const isPastChallenge = challenge.settlementStatus === 'settled' || challenge.settlementStatus === 'cancelled';

  // Determine what to show in the days/status column
  const getStatusText = () => {
    if (challenge.isJoined) {
      return 'Joined';
    }
    if (isPastChallenge) {
      return 'Completed';
    }
    return challenge.daysLeft > 0 ? `${challenge.daysLeft} days left` : 'Ending soon';
  };

  return (
    <TouchableOpacity
      style={[styles.challengeCard, { backgroundColor: colors.background }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.challengeHeader}>
        <Text style={styles.categoryIcon}>
          {getCategoryIcon(challenge.category)}
        </Text>

        <View style={styles.challengeInfo}>
          <Text style={[styles.challengeTitle, { color: colors.text }]}>
            {challenge.title}
          </Text>

          {/* Creator */}
          {challenge.createdBy && (
            <TouchableOpacity
              style={styles.creatorContainer}
              onPress={handleCreatorPress}
              activeOpacity={0.7}
            >
              {challenge.createdBy.avatar ? (
                <Image
                  source={{ uri: challenge.createdBy.avatar }}
                  style={styles.creatorAvatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder} />
              )}

              <Text
                style={[
                  styles.creatorName,
                  { color: colors.icon ?? colors.text },
                ]}
              >
                @{challenge.createdBy.username}
              </Text>
            </TouchableOpacity>
          )}

          <Text
            style={[
              styles.challengeDescription,
              { color: colors.icon ?? colors.text },
            ]}
            numberOfLines={2}
          >
            {challenge.description}
          </Text>

          {/* Schedule Info (from upload screen) */}
          {challenge.schedule && !isPastChallenge && (
            <View style={styles.scheduleContainer}>
              <View style={styles.scheduleItem}>
                <Ionicons name="calendar" size={14} color={colors.icon} style={styles.scheduleIcon} />
                <Text style={[styles.scheduleText, { color: colors.icon }]}>
                  {challenge.schedule.days.join(', ')} at {challenge.schedule.time}
                </Text>
              </View>
              {(challenge.schedule.startTime || challenge.schedule.endTime) && (
                <View style={styles.scheduleItem}>
                  <Ionicons name="time" size={14} color={colors.icon} style={styles.scheduleIcon} />
                  <Text style={[styles.scheduleText, { color: colors.icon }]}>
                    {challenge.schedule.startTime || 'N/A'} - {challenge.schedule.endTime || 'N/A'}
                  </Text>
                </View>
              )}
              <View style={styles.scheduleItem}>
                <Ionicons name="repeat" size={14} color={colors.icon} style={styles.scheduleIcon} />
                <Text style={[styles.scheduleText, { color: colors.icon }]}>
                  {getRepeatLabel(challenge.schedule.repeat)}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.metaRow}>
            <Text style={{ color: getDifficultyColor(challenge.difficulty) }}>
              {challenge.difficulty}
            </Text>
            <Text style={{ color: colors.text }}>
              {challenge.participants} joined
            </Text>
            <Text style={{ 
              color: challenge.isJoined ? '#2ed573' : colors.text,
              fontWeight: challenge.isJoined ? '600' : '400'
            }}>
              {getStatusText()}
            </Text>
          </View>

          {/* Entry Fee, Reward & Stake Info */}
          {(challenge.entryFee !== undefined || challenge.currentStake !== undefined) && !isPastChallenge && (
            <View style={styles.rewardRow}>
              {/* Entry Fee */}
              {challenge.entryFee !== undefined && challenge.entryFee > 0 && (
                <View style={styles.entryFeeContainer}>
                  <Text style={styles.entryFeeLabel}>Entry:</Text>
                  <Text style={styles.entryFeeValue}>${challenge.entryFee.toFixed(2)}</Text>
                </View>
              )}
              
              {/* Current Stake */}
              {challenge.currentStake !== undefined && challenge.currentStake > 0 && (
                <View style={styles.stakeContainer}>
                  <Ionicons name="cash" size={14} color="#8e44ad" style={styles.stakeIcon} />
                  <Text style={styles.stakeLabel}>Stake:</Text>
                  <Text style={styles.stakeValue}>${challenge.currentStake.toFixed(2)}</Text>
                </View>
              )}
              
              {/* Potential Reward */}
              {challenge.potentialReward !== undefined && (
                <View style={styles.potentialRewardContainer}>
                  <Text style={styles.potentialRewardLabel}>Reward:</Text>
                  <Text style={styles.potentialRewardValue}>
                    ${challenge.potentialReward.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Total Pool & Settlement Status */}
          {(challenge.totalPool !== undefined || challenge.settlementStatus) && (
            <View style={styles.poolRow}>
              {challenge.totalPool !== undefined && challenge.totalPool > 0 && (
                <View style={styles.poolContainer}>
                  <Ionicons name="trophy" size={14} color="#ffa502" style={styles.poolIcon} />
                  <Text style={styles.poolLabel}>Pool:</Text>
                  <Text style={styles.poolValue}>${challenge.totalPool.toFixed(2)}</Text>
                </View>
              )}
              
              {challenge.settlementStatus && challenge.settlementStatus !== 'pending' && (
                <View style={[styles.statusBadge, { backgroundColor: getSettlementStatusColor(challenge.settlementStatus) + '20' }]}>
                  <Text style={[styles.statusText, { color: getSettlementStatusColor(challenge.settlementStatus) }]}>
                    {challenge.settlementStatus === 'settled' && `🏆 ${challenge.winnersCount || 0} winners`}
                    {challenge.settlementStatus === 'processing' && '⏳ Processing'}
                    {challenge.settlementStatus === 'cancelled' && '❌ Cancelled'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* User's Result for Past Challenges */}
          {isPastChallenge && challenge.isWinner !== undefined && (
            <View style={[
              styles.resultRow, 
              { backgroundColor: challenge.isWinner ? '#d4edda' : '#f8d7da' }
            ]}>
              {challenge.isWinner ? (
                <>
                  <Text style={styles.resultEmoji}>🏆</Text>
                  <Text style={[styles.resultText, { color: '#155724' }]}>
                    You Won! +${(challenge.payoutAmount || 0).toFixed(2)}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.resultEmoji}>😔</Text>
                  <Text style={[styles.resultText, { color: '#721c24' }]}>
                    Challenge Lost
                  </Text>
                </>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Delete Button for My Uploads */}
      {onDelete && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={onDelete}
          activeOpacity={0.8}
        >
          <Ionicons name="trash-outline" size={18} color="#ff4757" />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      )}

      {onJoin && !isPastChallenge && !onDelete && (
        <TouchableOpacity
          style={styles.joinButton}
          onPress={onJoin}
          activeOpacity={0.8}
        >
          <Text style={styles.joinButtonText}>
            {challenge.currentStake ? `Join $${challenge.currentStake}` : challenge.entryFee ? `Join $${challenge.entryFee}` : 'Join'}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  challengeCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  challengeHeader: {
    flexDirection: 'row',
  },
  categoryIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  creatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  creatorAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 6,
  },
  avatarPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ccc',
    marginRight: 6,
  },
  creatorName: {
    fontSize: 13,
  },
  challengeDescription: {
    fontSize: 14,
    marginBottom: 8,
  },
  scheduleContainer: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  scheduleIcon: {
    marginRight: 4,
  },
  scheduleText: {
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rewardRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 12,
  },
  entryFeeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryFeeLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  entryFeeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4e73df',
  },
  stakeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stakeIcon: {
    marginRight: 4,
  },
  stakeLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  stakeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8e44ad',
  },
  potentialRewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  potentialRewardLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  potentialRewardValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2ed573',
  },
  poolRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 6,
    gap: 12,
  },
  poolContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  poolIcon: {
    marginRight: 4,
  },
  poolLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  poolValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffa502',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  resultEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  resultText: {
    fontSize: 14,
    fontWeight: '600',
  },
  joinButton: {
    marginTop: 12,
    backgroundColor: '#4e73df',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  deleteButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ff4757',
  },
  deleteButtonText: {
    color: '#ff4757',
    fontWeight: '600',
    marginLeft: 6,
  },
});
