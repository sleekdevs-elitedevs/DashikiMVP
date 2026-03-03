// Settlement API Service
// Handles stakes generation, winner determination, and prize distribution

import { supabase } from '../lib/supabase';

// =====================================================
// Types
// =====================================================

export interface Settlement {
  id: string;
  challenge_id: string;
  total_pool: number;
  winners_count: number;
  losers_count: number;
  per_winner_payout: number;
  platform_fee: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  settled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SettlementPayout {
  id: string;
  settlement_id: string;
  participant_id: string;
  user_id: string;
  challenge_id: string;
  stake_amount: number;
  payout_amount: number;
  is_winner: boolean;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  completed_at: string | null;
}

export interface StakeCalculation {
  baseStake: number;
  difficultyMultiplier: number;
  participantMultiplier: number;
  finalStake: number;
  potentialReward: number;
  platformFee: number;
}

export interface WinnerResult {
  participantId: string;
  userId: string;
  username: string;
  stakeAmount: number;
  proofCount: number;
  isWinner: boolean;
  payoutAmount: number;
}

export interface ChallengeWithSettlement extends Challenge {
  current_stake: number;
  min_stake: number;
  max_stake: number;
  stake_multiplier: number;
  total_pool: number;
  winners_count: number;
  losers_count: number;
  settled_at: string | null;
  settlement_status: 'pending' | 'processing' | 'settled' | 'cancelled';
  completion_threshold: number;
}

interface Challenge {
  id: string;
  entry_fee: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  participants_count: number;
  potential_reward: number;
}

// =====================================================
// Stakes Generator
// =====================================================

const DIFFICULTY_MULTIPLIERS = {
  'Easy': 1.00,
  'Medium': 1.50,
  'Hard': 2.00,
};

const PLATFORM_FEE_PERCENT = 10;
const MIN_STAKE = 1.00;
const MAX_STAKE = 1000.00;
const PARTICIPANT_BONUS_PERCENT = 5; // 5% bonus per participant

/**
 * Calculate the stake for a challenge based on entry fee, difficulty, and participant count
 */
export function calculateStake(
  entryFee: number,
  difficulty: 'Easy' | 'Medium' | 'Hard',
  participantCount: number
): StakeCalculation {
  const difficultyMultiplier = DIFFICULTY_MULTIPLIERS[difficulty] || 1.00;
  
  // Base stake calculation
  let baseStake = entryFee * difficultyMultiplier;
  
  // Participant count multiplier (more participants = higher stakes)
  const participantMultiplier = 1 + (participantCount * PARTICIPANT_BONUS_PERCENT / 100);
  
  // Final stake
  let finalStake = baseStake * participantMultiplier;
  
  // Apply limits
  finalStake = Math.max(MIN_STAKE, Math.min(MAX_STAKE, finalStake));
  
  // Calculate potential reward
  const totalPool = finalStake * participantCount;
  const platformFee = totalPool * (PLATFORM_FEE_PERCENT / 100);
  const distributable = totalPool - platformFee;
  const potentialReward = distributable * 2; // Assuming 50% win rate for estimation
  
  return {
    baseStake: Math.round(baseStake * 100) / 100,
    difficultyMultiplier,
    participantMultiplier: Math.round(participantMultiplier * 100) / 100,
    finalStake: Math.round(finalStake * 100) / 100,
    potentialReward: Math.round(potentialReward * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
  };
}

/**
 * Generate stakes for a new challenge or when participants change
 */
export function generateStakes(
  entryFee: number,
  difficulty: 'Easy' | 'Medium' | 'Hard',
  participantCount: number
): {
  stake: number;
  potentialReward: number;
  totalPool: number;
} {
  const calculation = calculateStake(entryFee, difficulty, participantCount);
  
  return {
    stake: calculation.finalStake,
    potentialReward: calculation.potentialReward,
    totalPool: calculation.finalStake * Math.max(1, participantCount),
  };
}

// =====================================================
// Winning Algorithm
// =====================================================

/**
 * Determine winners based on completed participants and their proof counts
 */
export async function determineWinners(challengeId: string): Promise<WinnerResult[]> {
  // Get all completed participants with their proof counts
  const { data: participants, error } = await supabase
    .from('challenge_participants')
    .select(`
      id,
      user_id,
      stake_on_join,
      status,
      completed_at,
      profiles:user_id (username)
    `)
    .eq('challenge_id', challengeId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: true });

  if (error) throw error;
  if (!participants || participants.length === 0) {
    return [];
  }

  // Get proof counts for each participant
  const participantsWithProofs = await Promise.all(
    participants.map(async (participant: any) => {
      const { count } = await supabase
        .from('challenge_proofs')
        .select('id', { count: 'exact' })
        .eq('participant_id', participant.id)
        .eq('approved', true);

      return {
        participantId: participant.id,
        userId: participant.user_id,
        username: participant.profiles?.username || 'Unknown',
        stakeAmount: participant.stake_on_join || 0,
        proofCount: count || 0,
        completedAt: participant.completed_at,
      };
    })
  );

  // Sort by proof count (descending), then by completion time (ascending) for tie-breaking
  const sortedParticipants = participantsWithProofs.sort((a, b) => {
    if (b.proofCount !== a.proofCount) {
      return b.proofCount - a.proofCount; // More proofs = higher rank
    }
    return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(); // Earlier completion = higher rank
  });

  // Map to WinnerResult with default values for isWinner and payoutAmount
  return sortedParticipants.map(p => ({
    participantId: p.participantId,
    userId: p.userId,
    username: p.username,
    stakeAmount: p.stakeAmount,
    proofCount: p.proofCount,
    isWinner: false, // Will be determined during settlement
    payoutAmount: 0, // Will be calculated during settlement
  }));
}

/**
 * Calculate winner distribution based on total pool and number of winners
 */
export function calculateDistribution(
  totalPool: number,
  winnerCount: number,
  platformFeePercent: number = PLATFORM_FEE_PERCENT
): {
  platformFee: number;
  distributableAmount: number;
  perWinnerPayout: number;
  loserForfeiture: number;
} {
  if (winnerCount <= 0) {
    return {
      platformFee: 0,
      distributableAmount: 0,
      perWinnerPayout: 0,
      loserForfeiture: 0,
    };
  }

  const platformFee = totalPool * (platformFeePercent / 100);
  const distributableAmount = totalPool - platformFee;
  const perWinnerPayout = distributableAmount / winnerCount;
  
  return {
    platformFee: Math.round(platformFee * 100) / 100,
    distributableAmount: Math.round(distributableAmount * 100) / 100,
    perWinnerPayout: Math.round(perWinnerPayout * 100) / 100,
    loserForfeiture: Math.round((totalPool - distributableAmount) * 100) / 100,
  };
}

// =====================================================
// Settlement API
// =====================================================

export const settlementApi = {
  /**
   * Get settlement by challenge ID
   */
  async getByChallenge(challengeId: string): Promise<Settlement | null> {
    const { data, error } = await supabase
      .from('challenge_settlements')
      .select('*')
      .eq('challenge_id', challengeId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  /**
   * Get all settlements for a user
   */
  async getByUser(userId: string): Promise<SettlementPayout[]> {
    const { data, error } = await supabase
      .from('settlement_payouts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get user's payout for a specific challenge
   */
  async getUserPayout(challengeId: string, userId: string): Promise<SettlementPayout | null> {
    const { data, error } = await supabase
      .from('settlement_payouts')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  /**
   * Create settlement (trigger backend calculation)
   */
  async createSettlement(
    challengeId: string,
    winnersPercentage: number = 50
  ): Promise<Settlement> {
    // Call the PostgreSQL function via RPC
    const { data, error } = await supabase.rpc('settle_challenge', {
      p_challenge_id: challengeId,
      p_winners_percentage: winnersPercentage,
    });

    if (error) throw error;

    // Get the created settlement
    const settlement = await this.getByChallenge(challengeId);
    if (!settlement) {
      throw new Error('Failed to create settlement');
    }

    return settlement;
  },

  /**
   * Update challenge stake (called when participants join/leave)
   */
  async updateStake(challengeId: string): Promise<void> {
    const { error } = await supabase.rpc('update_challenge_stake', {
      p_challenge_id: challengeId,
    });

    if (error) throw error;
  },

  /**
   * Get pending settlements (for admin)
   */
  async getPendingSettlements(): Promise<Settlement[]> {
    const { data, error } = await supabase
      .from('challenge_settlements')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get settlement statistics for a user
   */
  async getUserStats(userId: string): Promise<{
    totalWinnings: number;
    totalForfeited: number;
    winCount: number;
    lossCount: number;
  }> {
    const payouts = await this.getByUser(userId);

    const wins = payouts.filter(p => p.is_winner);
    const losses = payouts.filter(p => !p.is_winner);

    return {
      totalWinnings: wins.reduce((sum, w) => sum + w.payout_amount, 0),
      totalForfeited: losses.reduce((sum, l) => sum + l.stake_amount, 0),
      winCount: wins.length,
      lossCount: losses.length,
    };
  },

  /**
   * Preview settlement calculation (without executing)
   */
  async previewSettlement(challengeId: string): Promise<{
    totalPool: number;
    winnerCount: number;
    perWinnerPayout: number;
    platformFee: number;
    winners: WinnerResult[];
  }> {
    // Get challenge details
    const { data: challenge } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single();

    if (!challenge) {
      throw new Error('Challenge not found');
    }

    // Get all completed participants
    const { data: participants } = await supabase
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('status', 'completed');

    const winners = await determineWinners(challengeId);
    const winnerCount = winners.length;
    const totalPool = challenge.current_stake * challenge.participants_count;
    
    const distribution = calculateDistribution(totalPool, winnerCount);

    return {
      totalPool,
      winnerCount,
      perWinnerPayout: distribution.perWinnerPayout,
      platformFee: distribution.platformFee,
      winners,
    };
  },
};

// =====================================================
// Helper Functions
// =====================================================

/**
 * Check if a challenge is ready for settlement
 */
export function isReadyForSettlement(
  challengeStatus: string,
  endDate: Date | null,
  participantsCount: number
): boolean {
  if (challengeStatus !== 'Active') return false;
  if (participantsCount < 1) return false;
  
  // If end date is set, check if it has passed
  if (endDate) {
    return new Date() >= endDate;
  }
  
  // If no end date, allow manual settlement
  return true;
}

/**
 * Calculate win rate for display
 */
export function calculateWinRate(wins: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((wins / total) * 100)}%`;
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
