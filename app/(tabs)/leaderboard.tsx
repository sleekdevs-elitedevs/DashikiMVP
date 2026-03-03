import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { profilesApi, Profile } from '@/api/profiles';
import { participantsApi, Participant } from '@/api/participants';
import { challengesApi, Challenge } from '@/api/challenges';
import { calculateUserPoints, getBadgeForPoints, ParticipantWithChallenge } from '@/lib/points';

interface LeaderboardUser {
  id: string;
  rank: number;
  username: string;
  avatar: string;
  points: number;
  challenges: number;
  streak: number;
  badge: string;
}

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch leaderboard data - all time, matching profile page behavior
  const fetchLeaderboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get all profiles
      const profiles = await profilesApi.getAll();
      
      // For each user, calculate their points using the points utility (all time - no date filter)
      const usersWithStats: LeaderboardUser[] = await Promise.all(
        profiles.map(async (profile, index) => {
          let points = 0;
          let challenges = 0;
          let streak = 0;
          
          try {
            // Get user's participants - ALL participants, no date filtering
            const userParticipants = await participantsApi.getByUser(profile.id);
            
            // Use all participants (no filtering by date)
            const allParticipants = userParticipants;
            
            challenges = allParticipants.length;
            
            // Get challenge details for each participant
            const participantsWithChallenges: ParticipantWithChallenge[] = await Promise.all(
              allParticipants.map(async (participant) => {
                try {
                  const challenge = await challengesApi.getById(participant.challenge_id);
                  return { ...participant, challenge } as ParticipantWithChallenge;
                } catch (e) {
                  return { ...participant } as ParticipantWithChallenge;
                }
              })
            );
            
            // Calculate points using the points utility
            const pointsBreakdown = calculateUserPoints(participantsWithChallenges);
            points = pointsBreakdown.totalPoints;
            streak = pointsBreakdown.currentStreak;
            
          } catch (error) {
            console.error('Error fetching participant data:', error);
          }

          // Assign badge based on points
          return {
            id: profile.id,
            rank: 0,
            username: profile.username,
            avatar: profile.avatar_url || `https://i.pravatar.cc/150?img=${index + 1}`,
            points,
            challenges,
            streak,
            badge: getBadgeForPoints(points),
          };
        })
      );

      // Sort by points and assign ranks
      const sortedUsers = usersWithStats
        .sort((a, b) => b.points - a.points)
        .map((user, index) => ({
          ...user,
          rank: index + 1,
          badge: index === 0 ? '👑' : index === 1 ? '🔥' : index === 2 ? '🌟' : getBadgeForPoints(user.points),
        }));

      setLeaderboardData(sortedUsers);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboardData();
  }, [fetchLeaderboardData]);

  const handleUserPress = (userId: string) => {
    router.push({ pathname: '/profile/[id]', params: { id: userId } });
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Leaderboard</Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}>All Time</Text>
      </View>

      {/* Top 3 Podium */}
      <View style={[styles.podiumContainer, { backgroundColor: colors.background }]}>
        {/* Second Place */}
        <TouchableOpacity 
          style={styles.podiumItem}
          onPress={() => handleUserPress(leaderboardData[1]?.id || '')}
        >
          <View style={[styles.avatarContainer, styles.avatarContainerSecond]}>
            <Image source={{ uri: leaderboardData[1]?.avatar }} style={styles.podiumAvatarImage} />
          </View>
          <Text style={[styles.podiumUsername, { color: colors.text }]}>{leaderboardData[1]?.username || '-'}</Text>
          <Text style={[styles.podiumPoints, { color: colors.icon }]}>{leaderboardData[1]?.points.toLocaleString() || 0} pts</Text>
          <View style={[styles.podiumStand, styles.podiumStandSecond]}>
            <Text style={styles.podiumRank}>2</Text>
          </View>
        </TouchableOpacity>

        {/* First Place */}
        <TouchableOpacity 
          style={styles.podiumItem}
          onPress={() => handleUserPress(leaderboardData[0]?.id || '')}
        >
          <View style={[styles.avatarContainer, styles.avatarContainerFirst]}>
            <Image source={{ uri: leaderboardData[0]?.avatar }} style={styles.podiumAvatarImage} />
          </View>
          <Text style={[styles.podiumUsername, { color: colors.text }]}>{leaderboardData[0]?.username || '-'}</Text>
          <Text style={[styles.podiumPoints, { color: colors.icon }]}>{leaderboardData[0]?.points.toLocaleString() || 0} pts</Text>
          <View style={[styles.podiumStand, styles.podiumStandFirst]}>
            <Text style={styles.podiumRank}>1</Text>
          </View>
        </TouchableOpacity>

        {/* Third Place */}
        <TouchableOpacity 
          style={styles.podiumItem}
          onPress={() => handleUserPress(leaderboardData[2]?.id || '')}
        >
          <View style={[styles.avatarContainer, styles.avatarContainerThird]}>
            <Image source={{ uri: leaderboardData[2]?.avatar }} style={styles.podiumAvatarImage} />
          </View>
          <Text style={[styles.podiumUsername, { color: colors.text }]}>{leaderboardData[2]?.username || '-'}</Text>
          <Text style={[styles.podiumPoints, { color: colors.icon }]}>{leaderboardData[2]?.points.toLocaleString() || 0} pts</Text>
          <View style={[styles.podiumStand, styles.podiumStandThird]}>
            <Text style={styles.podiumRank}>3</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Leaderboard List */}
      <ScrollView showsVerticalScrollIndicator={false} style={styles.leaderboardList}>
        {leaderboardData.slice(3).map((user) => (
          <TouchableOpacity 
            key={user.id} 
            style={[styles.leaderboardItem, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}
            onPress={() => handleUserPress(user.id)}
          >
            <View style={styles.rankContainer}>
              <Text style={[styles.rankNumber, { color: colors.icon }]}>{user.rank}</Text>
            </View>
            <View style={styles.userInfo}>
              <Image source={{ uri: user.avatar }} style={styles.userAvatarImage} />
              <View style={styles.userDetails}>
                <Text style={[styles.username, { color: colors.text }]}>{user.username}</Text>
                <Text style={[styles.userStats, { color: colors.icon }]}>
                  {user.challenges} challenges • {user.streak} day streak
                </Text>
              </View>
            </View>
            <View style={styles.rightSection}>
              <Text style={[styles.points, { color: colors.tint }]}>{user.points.toLocaleString()}</Text>
              <Text style={[styles.arrow, { color: colors.icon }]}>›</Text>
            </View>
          </TouchableOpacity>
        ))}
        
        {leaderboardData.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.icon }]}>No leaderboard data available</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 15,
    paddingTop: 20,
    paddingBottom: 10,
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  podiumItem: {
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  avatarContainerFirst: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffd700',
    borderWidth: 3,
    borderColor: '#ffd700',
  },
  avatarContainerSecond: {
    backgroundColor: '#c0c0c0',
  },
  avatarContainerThird: {
    backgroundColor: '#cd7f32',
  },
  podiumAvatarImage: {
    width: '100%',
    height: '100%',
  },
  podiumUsername: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  podiumPoints: {
    fontSize: 11,
    marginBottom: 8,
  },
  podiumStand: {
    width: '80%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  podiumStandFirst: {
    height: 80,
    backgroundColor: '#ffd700',
  },
  podiumStandSecond: {
    height: 60,
    backgroundColor: '#c0c0c0',
  },
  podiumStandThird: {
    height: 45,
    backgroundColor: '#cd7f32',
  },
  podiumRank: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  leaderboardList: {
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 20,
  },
  leaderboardItem: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  rankContainer: {
    width: 30,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: 18,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  userStats: {
    fontSize: 12,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  points: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  arrow: {
    fontSize: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
  },
});
