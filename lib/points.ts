/**
 * Points Calculation Utility
 * 
 * A comprehensive algorithm for calculating user points based on multiple factors:
 * - Challenge completion
 * - Challenge victories
 * - Participation consistency
 * - Stake amounts (risk/reward)
 * - Challenge difficulty
 * - Challenge category
 * - Streak/consistent participation
 * - Payout earned
 */

import { Participant } from '@/api/participants';
import { Challenge } from '@/api/challenges';

// Configuration weights for point calculation
export interface PointsConfig {
  // Base points
  completionBasePoints: number;      // Points for completing a challenge
  victoryBonusMultiplier: number;     // Multiplier for winning
  
  // Participation factors
  joinBonusPoints: number;            // Points just for joining a challenge
  consecutiveBonusPoints: number;     // Bonus for consecutive completions
  
  // Stake-based points
  stakeBonusPerDollar: number;       // Points per dollar staked
  
  // Difficulty multipliers
  difficultyMultipliers: {
    Easy: number;
    Medium: number;
    Hard: number;
  };
  
  // Category multipliers
  categoryMultipliers: Record<string, number>;
  
  // Streak bonuses
  streakBonusThreshold: number;       // Days to start streak bonus
  streakBonusPerDay: number;          // Extra points per streak day
  
  // Penalty factors
  dropoutPenaltyPercent: number;     // Penalty for dropping out
  incompletePenaltyPercent: number;  // Penalty for incomplete challenges
}

// Default configuration
export const defaultPointsConfig: PointsConfig = {
  completionBasePoints: 100,
  victoryBonusMultiplier: 1.5,
  joinBonusPoints: 10,
  consecutiveBonusPoints: 5,
  stakeBonusPerDollar: 50,
  difficultyMultipliers: {
    Easy: 1.0,
    Medium: 1.5,
    Hard: 2.0,
  },
  categoryMultipliers: {
    Fitness: 1.2,
    Health: 1.2,
    Learning: 1.3,
    Environmental: 1.1,
    Social: 1.0,
    Creative: 1.3,
    Mindfulness: 1.1,
    Default: 1.0,
  },
  streakBonusThreshold: 3,
  streakBonusPerDay: 10,
  dropoutPenaltyPercent: 0.5,
  incompletePenaltyPercent: 0.25,
};

// Extended participant data with challenge info
export interface ParticipantWithChallenge extends Participant {
  challenge?: Challenge;
}

/**
 * Calculate points for a single participation
 */
export function calculateParticipationPoints(
  participant: ParticipantWithChallenge,
  config: PointsConfig = defaultPointsConfig
): number {
  let points = 0;
  const challenge = participant.challenge;

  // 1. Base points for joining
  points += config.joinBonusPoints;

  if (!challenge) {
    return Math.round(points);
  }

  // 2. Difficulty multiplier
  const difficultyMultiplier = config.difficultyMultipliers[challenge.difficulty] || 1.0;
  
  // 3. Category multiplier
  const categoryMultiplier = config.categoryMultipliers[challenge.category] || config.categoryMultipliers.Default;

  // 4. Calculate based on status
  switch (participant.status) {
    case 'completed':
      // Base completion points
      points += config.completionBasePoints * difficultyMultiplier * categoryMultiplier;
      
      // Victory bonus
      if (participant.is_winner) {
        points *= config.victoryBonusMultiplier;
      }
      break;
      
    case 'joined':
      // Incomplete - partial points
      points += (config.completionBasePoints * config.incompletePenaltyPercent) * difficultyMultiplier;
      break;
      
    case 'dropped':
      // Dropout penalty - negative points
      points -= (config.joinBonusPoints * config.dropoutPenaltyPercent);
      points = Math.max(0, points); // Don't allow negative
      break;
  }

  // 5. Stake bonus (risk/reward)
  if (participant.stake_on_join && participant.stake_on_join > 0) {
    points += participant.stake_on_join * config.stakeBonusPerDollar;
  }

  // 6. Payout bonus (for winners)
  if (participant.is_winner && participant.payout_amount) {
    // Bonus points based on payout
    points += participant.payout_amount * 10;
  }

  return Math.round(points);
}

/**
 * Calculate streak from participation dates
 */
export function calculateStreak(participants: Participant[]): number {
  if (participants.length === 0) return 0;

  // Sort by join date (most recent first)
  const sorted = [...participants].sort((a, b) => 
    new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime()
  );

  // Filter completed within last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentCompleted = sorted.filter(p => 
    p.status === 'completed' && 
    new Date(p.completed_at || p.joined_at) > thirtyDaysAgo
  );

  if (recentCompleted.length === 0) return 0;

  // Calculate consecutive days
  let streak = 1;
  for (let i = 0; i < recentCompleted.length - 1; i++) {
    const current = new Date(recentCompleted[i].completed_at || recentCompleted[i].joined_at);
    const next = new Date(recentCompleted[i + 1].completed_at || recentCompleted[i + 1].joined_at);
    
    const diffDays = Math.floor((current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calculate streak bonus points
 */
export function calculateStreakBonus(
  streak: number,
  config: PointsConfig = defaultPointsConfig
): number {
  if (streak < config.streakBonusThreshold) return 0;
  
  // Extra points for each day beyond threshold
  const bonusDays = streak - config.streakBonusThreshold;
  return bonusDays * config.streakBonusPerDay;
}

/**
 * Calculate total points for a user
 */
export interface PointsBreakdown {
  totalPoints: number;
  joinPoints: number;
  completionPoints: number;
  victoryPoints: number;
  stakeBonusPoints: number;
  streakBonusPoints: number;
  penaltyPoints: number;
  totalChallenges: number;
  completedChallenges: number;
  wonChallenges: number;
  droppedChallenges: number;
  currentStreak: number;
}

export function calculateUserPoints(
  participants: ParticipantWithChallenge[],
  config: PointsConfig = defaultPointsConfig
): PointsBreakdown {
  let joinPoints = 0;
  let completionPoints = 0;
  let victoryPoints = 0;
  let stakeBonusPoints = 0;
  let penaltyPoints = 0;
  let completedChallenges = 0;
  let wonChallenges = 0;
  let droppedChallenges = 0;

  // Calculate points for each participation
  participants.forEach(participant => {
    const points = calculateParticipationPoints(participant, config);
    
    // Accumulate by category
    if (participant.status === 'joined') {
      // Incomplete - partial completion points
      const challenge = participant.challenge;
      if (challenge) {
        const difficultyMult = config.difficultyMultipliers[challenge.difficulty] || 1.0;
        completionPoints += config.completionBasePoints * config.incompletePenaltyPercent * difficultyMult;
      }
    } else if (participant.status === 'completed') {
      completionPoints += points;
      completedChallenges++;
      
      if (participant.is_winner) {
        victoryPoints += points * (config.victoryBonusMultiplier - 1);
        wonChallenges++;
      }
    } else if (participant.status === 'dropped') {
      penaltyPoints += Math.abs(points);
      droppedChallenges++;
    }

    // Stake bonus
    if (participant.stake_on_join) {
      stakeBonusPoints += participant.stake_on_join * config.stakeBonusPerDollar;
    }
  });

  // Join bonus
  joinPoints = participants.length * config.joinBonusPoints;

  // Calculate streak
  const currentStreak = calculateStreak(participants);
  const streakBonusPoints = calculateStreakBonus(currentStreak, config);

  // Calculate totals
  const totalPoints = Math.round(
    joinPoints + 
    completionPoints + 
    victoryPoints + 
    stakeBonusPoints + 
    streakBonusPoints - 
    penaltyPoints
  );

  return {
    totalPoints: Math.max(0, totalPoints),
    joinPoints: Math.round(joinPoints),
    completionPoints: Math.round(completionPoints),
    victoryPoints: Math.round(victoryPoints),
    stakeBonusPoints: Math.round(stakeBonusPoints),
    streakBonusPoints,
    penaltyPoints: Math.round(penaltyPoints),
    totalChallenges: participants.length,
    completedChallenges,
    wonChallenges,
    droppedChallenges,
    currentStreak,
  };
}

/**
 * Get a user-friendly description of point sources
 */
export function getPointsDescription(breakdown: PointsBreakdown): string {
  const parts: string[] = [];
  
  if (breakdown.completionPoints > 0) {
    parts.push(`${breakdown.completionPoints} from completions`);
  }
  if (breakdown.victoryPoints > 0) {
    parts.push(`${breakdown.victoryPoints} from wins`);
  }
  if (breakdown.stakeBonusPoints > 0) {
    parts.push(`${breakdown.streakBonusPoints} from stakes`);
  }
  if (breakdown.streakBonusPoints > 0) {
    parts.push(`${breakdown.streakBonusPoints} from streaks`);
  }
  if (breakdown.penaltyPoints > 0) {
    parts.push(`-${breakdown.penaltyPoints} penalties`);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'No points yet';
}

/**
 * Get badge based on points
 */
export function getBadgeForPoints(points: number): string {
  if (points >= 10000) return '👑';  // Champion
  if (points >= 5000) return '🔥';    // On Fire
  if (points >= 2000) return '💪';   // Strong
  if (points >= 1000) return '⭐';    // Rising Star
  if (points >= 500) return '🌱';    // Growing
  return '🌟';                        // Newcomer
}

/**
 * Get badge description
 */
export function getBadgeDescription(badge: string): string {
  switch (badge) {
    case '👑': return 'Champion - 10,000+ points';
    case '🔥': return 'On Fire - 5,000+ points';
    case '💪': return 'Strong - 2,000+ points';
    case '⭐': return 'Rising Star - 1,000+ points';
    case '🌱': return 'Growing - 500+ points';
    default: return 'Newcomer - Keep going!';
  }
}
