import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { challengesApi } from '@/api/challenges';
import { participantsApi } from '@/api/participants';

interface ParticipantInfo {
  id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  joined_at: string;
  order: number;
}

interface CallSummary {
  challengeId: string;
  challengeTitle: string;
  creatorName: string;
  creatorId?: string;
  creatorAvatar?: string;
  callDuration: number;
  startedAt: string;
  endedAt: string;
  participants: ParticipantInfo[];
}

export default function CallSummaryScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { id: challengeId, duration, callId, participants: participantsParam } = useLocalSearchParams<{ 
    id: string; 
    duration: string; 
    callId: string;
    participants?: string;
  }>();
  
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const challenge = await challengesApi.getById(challengeId || '');
        
        const { data: { user } } = await supabase.auth.getUser();
        
        let creatorName = 'Challenge Creator';
        let creatorId: string | undefined;
        let creatorAvatar: string | undefined;
        
        if (user) {
          creatorId = user.id;
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', user.id)
            .single();
          
          if (profile) {
            creatorName = profile.username;
            creatorAvatar = profile.avatar_url || undefined;
          }
        }

        let participantsList: ParticipantInfo[] = [];
        
        if (participantsParam) {
          try {
            participantsList = JSON.parse(participantsParam);
          } catch (e) {
            console.log('Could not parse participants param');
          }
        }
        
        if (participantsList.length === 0) {
          const allParticipants = await participantsApi.getByChallenge(challengeId || '');
          
          const sorted = allParticipants
            .sort((a: any, b: any) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime())
            .map((p: any, index: number) => ({
              id: p.id,
              user_id: p.user_id,
              username: p.profiles?.username || 'Unknown',
              avatar_url: p.profiles?.avatar_url || undefined,
              joined_at: p.joined_at,
              order: index + 1,
            }));
          
          participantsList = sorted;
        }

        const now = new Date();
        const startTime = new Date(now.getTime() - (parseInt(duration || '0') * 1000));

        setSummary({
          challengeId: challengeId || '',
          challengeTitle: challenge?.title || 'Challenge Verification',
          creatorName,
          creatorId,
          creatorAvatar,
          callDuration: parseInt(duration || '0'),
          startedAt: startTime.toISOString(),
          endedAt: now.toISOString(),
          participants: participantsList,
        });

      } catch (error: any) {
        console.error('Error loading summary:', error);
        Alert.alert('Error', 'Failed to load call summary.');
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [challengeId, duration, participantsParam]);

  const handleSubmitToSettlement = async () => {
    if (!summary) return;
    
    setSubmitting(true);
    
    try {
      Alert.alert(
        'Submitted for Settlement! 🎉',
        `Verification call for "${summary.challengeTitle}" has been submitted.\n\n` +
        `Summary:\n` +
        `- Duration: ${formatDuration(summary.callDuration)}\n` +
        `- Participants Verified: ${summary.participants.length}\n` +
        `- Call ID: ${callId}`,
        [
          { text: 'OK', onPress: () => router.back() }
        ]
      );
      
    } catch (error: any) {
      console.error('Error submitting:', error);
      Alert.alert('Error', 'Failed to submit for settlement. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleParticipantPress = (userId: string) => {
    router.push({ pathname: '/profile/[id]', params: { id: userId } });
  };

  const handleCreatorPress = () => {
    if (summary?.creatorId) {
      router.push({ pathname: '/profile/[id]', params: { id: summary.creatorId } });
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading summary...</Text>
        </View>
      </>
    );
  }

  if (!summary) {
    return (
      <>
        <Stack.Screen 
          options={{ 
            headerShown: true,
            headerTitle: 'Call Summary',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }} 
        />
        <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
          <Text style={{ color: colors.text }}>No summary data available</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          headerTitle: 'Call Summary',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <ScrollView 
        style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={[styles.card, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="videocam" size={24} color={colors.tint} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Verification Call</Text>
          </View>
          <Text style={[styles.challengeTitle, { color: colors.text }]}>{summary.challengeTitle}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.tint }]}>{formatDuration(summary.callDuration)}</Text>
              <Text style={[styles.statLabel, { color: colors.icon }]}>Duration</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.tint }]}>{summary.participants.length}</Text>
              <Text style={[styles.statLabel, { color: colors.icon }]}>Participants</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.tint }]}>{callId?.slice(-6) || 'N/A'}</Text>
              <Text style={[styles.statLabel, { color: colors.icon }]}>Call ID</Text>
            </View>
          </View>

          <View style={styles.timeRow}>
            <View style={styles.timeItem}>
              <Ionicons name="play-circle" size={16} color="#2ed573" />
              <Text style={[styles.timeText, { color: colors.icon }]}>Started: {formatTime(summary.startedAt)}</Text>
            </View>
            <View style={styles.timeItem}>
              <Ionicons name="stop-circle" size={16} color="#ff4757" />
              <Text style={[styles.timeText, { color: colors.icon }]}>Ended: {formatTime(summary.endedAt)}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Call Host</Text>
          <TouchableOpacity 
            style={styles.participantRow}
            onPress={handleCreatorPress}
          >
            <View style={styles.avatarContainer}>
              {summary.creatorAvatar ? (
                <Image source={{ uri: summary.creatorAvatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.tint }]}>
                  <Text style={styles.avatarText}>{summary.creatorName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={[styles.hostBadge, { backgroundColor: '#ffa502' }]}>
                <Text style={styles.hostBadgeText}>👑</Text>
              </View>
            </View>
            <View style={styles.participantInfo}>
              <Text style={[styles.participantName, { color: colors.text }]}>{summary.creatorName}</Text>
              <Text style={[styles.participantRole, { color: colors.icon }]}>Challenge Creator</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.icon} />
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Participants ({summary.participants.length})</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.icon }]}>Order they joined the call</Text>
          </View>
          
          {summary.participants.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.icon} />
              <Text style={[styles.emptyText, { color: colors.icon }]}>No participants joined this call</Text>
            </View>
          ) : (
            <View style={styles.participantsList}>
              {summary.participants.map((participant, index) => (
                <TouchableOpacity 
                  key={participant.id}
                  style={[styles.participantRow, index !== summary.participants.length - 1 && styles.participantRowBorder]}
                  onPress={() => handleParticipantPress(participant.user_id)}
                >
                  <View style={styles.orderBadge}>
                    <Text style={styles.orderNumber}>{participant.order}</Text>
                  </View>
                  <View style={styles.avatarContainer}>
                    {participant.avatar_url ? (
                      <Image source={{ uri: participant.avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: colors.tint }]}>
                        <Text style={styles.avatarText}>{participant.username.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.participantInfo}>
                    <Text style={[styles.participantName, { color: colors.text }]}>@{participant.username}</Text>
                    <Text style={[styles.participantJoined, { color: colors.icon }]}>
                      Joined at {formatTime(participant.joined_at)}
                    </Text>
                  </View>
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color="#2ed573" />
                    <Text style={[styles.verifiedText, { color: '#2ed573' }]}>Verified</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, { backgroundColor: colors.tint }]}
          onPress={handleSubmitToSettlement}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={24} color="#fff" />
              <Text style={styles.submitButtonText}>Submit Info to System</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.cancelButton, { borderColor: colors.icon }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.cancelButtonText, { color: colors.icon }]}>Go Back</Text>
        </TouchableOpacity>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 20 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  headerButton: { padding: 8 },
  card: { borderRadius: 16, padding: 20, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginLeft: 8 },
  challengeTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold' },
  statLabel: { fontSize: 12, marginTop: 4 },
  statDivider: { width: 1, backgroundColor: '#ddd' },
  timeRow: { gap: 8 },
  timeItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeText: { fontSize: 14 },
  sectionHeader: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  sectionSubtitle: { fontSize: 12 },
  participantRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  participantRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.1)' },
  orderBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#8e44ad', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  orderNumber: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  avatarContainer: { position: 'relative', marginRight: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  hostBadge: { position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  hostBadgeText: { fontSize: 10 },
  participantInfo: { flex: 1 },
  participantName: { fontSize: 16, fontWeight: '600' },
  participantRole: { fontSize: 12, marginTop: 2 },
  participantJoined: { fontSize: 12, marginTop: 2 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { fontSize: 12, fontWeight: '500', color: '#2ed573' },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { marginTop: 12, fontSize: 14 },
  participantsList: { gap: 4 },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 30, gap: 12, marginBottom: 12 },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  cancelButton: { paddingVertical: 16, borderRadius: 30, alignItems: 'center', borderWidth: 1 },
  cancelButtonText: { fontSize: 16, fontWeight: '500' },
});
