import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Dimensions, Platform, PermissionsAndroid } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StreamVideoClient } from "@stream-io/video-react-native-sdk";
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { proofsApi } from '@/api/proofs';
import { participantsApi } from '@/api/participants';
import { challengesApi } from '@/api/challenges';
import { 
  joinCall, 
  leaveCall, 
  toggleMic, 
  toggleCamera, 
  switchCamera,
  getCallIdForChallenge,
  STREAM_API_KEY 
} from '@/video-calling-utilities';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface IncomingCallState {
  isRinging: boolean;
  isConnected: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  duration: number;
  callId: string | null;
}

export default function IncomingCallScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { id: challengeId } = useLocalSearchParams<{ id: string }>();
  
  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<any>(null);
  const [callerName, setCallerName] = useState<string>('Challenge Creator');
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<any>(null);
  const [callState, setCallState] = useState<IncomingCallState>({
    isRinging: true,
    isConnected: false,
    isMuted: false,
    isVideoOff: false,
    duration: 0,
    callId: null,
  });
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const initializeCall = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert('Error', 'You must be logged in to receive calls.', [
            { text: 'OK', onPress: () => router.back() }
          ]);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();
        
        const name = profile?.username || 'User';
        const token = await getStreamToken(user.id, name);

        if (!STREAM_API_KEY) {
          Alert.alert(
            'Configuration Error',
            'Stream API key is not configured. Please add EXPO_PUBLIC_STREAM_API_KEY to your .env file.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
          return;
        }

        const videoClient = new StreamVideoClient({
          apiKey: STREAM_API_KEY,
          user: { id: user.id, name: name },
          token: token,
        });

        setClient(videoClient);

        const challengeData = await challengesApi.getById(challengeId || '');
        if (challengeData) {
          setChallenge(challengeData);
          if (challengeData.creator_id) {
            const { data: creatorProfile } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', challengeData.creator_id)
              .single();
            if (creatorProfile) setCallerName(creatorProfile.username);
          }
        }
        await requestPermissions();
      } catch (error: any) {
        console.error('Error initializing call:', error);
        Alert.alert('Error', error.message || 'Failed to initialize call.');
      } finally {
        setLoading(false);
      }
    };

    initializeCall();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (call) leaveCall(call).catch(console.error);
      if (client) client.disconnectUser().catch(console.error);
    };
  }, [challengeId]);

  const getStreamToken = async (userId: string, userName: string): Promise<string> => {
    try {
      const response = await fetch('/api/stream-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userName }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.token;
      }
    } catch (error) { console.log('Could not fetch token from backend'); }
    return "YOUR_STREAM_TOKEN_HERE";
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const cameraPermission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
          title: 'Camera Permission',
          message: 'This app needs access to your camera for video verification.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        });
        const micPermission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
          title: 'Microphone Permission',
          message: 'This app needs access to your microphone for audio verification.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        });
        if (cameraPermission !== PermissionsAndroid.RESULTS.GRANTED || micPermission !== PermissionsAndroid.RESULTS.GRANTED) {
          return false;
        }
      } catch (err) { console.warn(err); }
    }
    return true;
  };

  const acceptCall = async () => {
    if (!client) { Alert.alert('Error', 'Video client not initialized'); return; }
    setCallState(prev => ({ ...prev, isRinging: false }));
    try {
      const callId = getCallIdForChallenge(challengeId || '');
      const videoCall = await joinCall(client, callId);
      setCall(videoCall);
      setCallState(prev => ({ ...prev, isConnected: true, callId: callId }));
      timerRef.current = setInterval(() => {
        setCallState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    } catch (error: any) {
      console.error('Error joining call:', error);
      Alert.alert('Error', 'Failed to join the call: ' + error.message);
    }
  };

  const declineCall = () => {
    Alert.alert('Call Declined', 'You have declined the verification call.', [{ text: 'OK', onPress: () => router.back() }]);
  };

  const handleToggleMute = async () => {
    if (!call) return;
    try {
      await toggleMic(call, callState.isMuted);
      setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    } catch (error) { console.error('Error toggling mute:', error); }
  };

  const handleToggleVideo = async () => {
    if (!call) return;
    try {
      await toggleCamera(call, callState.isVideoOff);
      setCallState(prev => ({ ...prev, isVideoOff: !prev.isVideoOff }));
    } catch (error) { console.error('Error toggling video:', error); }
  };

  const handleSwitchCamera = async () => {
    if (!call) return;
    try { await switchCamera(call); } catch (error) { console.error('Error switching camera:', error); }
  };

  const endCall = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (call) { try { await leaveCall(call); } catch (error) { console.error('Error leaving call:', error); } }
    const MIN_DURATION = 30;
    if (callState.duration < MIN_DURATION) {
      Alert.alert('Verification Too Short', `You need to be on the call for at least ${MIN_DURATION} seconds. Your call was ${callState.duration} seconds.`, [{ text: 'OK' }]);
      router.back();
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Error', 'Session expired.'); router.back(); return; }
      const participants = await participantsApi.getByUser(user.id);
      const participant = participants.find((p: any) => p.challenge_id === challengeId);
      if (!participant) { Alert.alert('Error', 'You are not a participant.'); router.back(); return; }
      const verificationProof = {
        user_id: user.id,
        challenge_id: challengeId,
        participant_id: participant.id,
        file_url: `stream-call-${callState.callId}`,
        file_type: 'video' as const,
        description: `Verification call - Duration: ${formatDuration(callState.duration)}`,
      };
      await proofsApi.create(verificationProof);
      Alert.alert('Verification Complete! 🎉', `You completed a ${formatDuration(callState.duration)} video verification.`, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error: any) {
      console.error('Error saving verification:', error);
      Alert.alert('Error', 'Failed to save verification.');
      router.back();
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Connecting...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: '#000', paddingTop: insets.top }]}>
        <View style={styles.callerInfo}>
          <View style={styles.callerAvatar}><Text style={styles.callerAvatarText}>{callerName.charAt(0).toUpperCase()}</Text></View>
          <Text style={styles.callerName}>@{callerName}</Text>
          <Text style={styles.callType}>{callState.isConnected ? 'Verification Call' : 'Incoming Verification Call...'}</Text>
        </View>

        <View style={styles.videoArea}>
          {callState.isConnected ? (
            <>
              <View style={styles.videoPreview}>
                <Ionicons name="person" size={80} color="#666" />
                <Text style={styles.videoPlaceholderText}>{callState.isVideoOff ? 'Camera Off' : 'Live Video'}</Text>
                <Text style={styles.callIdText}>Call ID: {callState.callId}</Text>
              </View>
              <View style={styles.durationBadge}>
                <Ionicons name="videocam" size={14} color="#fff" />
                <Text style={styles.durationText}>{formatDuration(callState.duration)}</Text>
              </View>
            </>
          ) : (
            <View style={styles.incomingCallView}>
              <View style={styles.ringContainer}>
                <View style={[styles.ring, callState.isRinging && styles.ringActive]} />
                <View style={[styles.ring, styles.ringMiddle, callState.isRinging && styles.ringActiveMiddle]} />
                <View style={styles.avatarContainer}><Text style={styles.avatarText}>{callerName.charAt(0).toUpperCase()}</Text></View>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.actionsArea, { paddingBottom: insets.bottom + 40 }]}>
          {callState.isConnected ? (
            <View style={styles.controlsRow}>
              <TouchableOpacity style={[styles.controlButton, callState.isMuted && styles.controlButtonActive]} onPress={handleToggleMute}>
                <Ionicons name={callState.isMuted ? 'mic-off' : 'mic'} size={28} color={callState.isMuted ? '#FF3B30' : '#fff'} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.controlButton, callState.isVideoOff && styles.controlButtonActive]} onPress={handleToggleVideo}>
                <Ionicons name={callState.isVideoOff ? 'videocam-off' : 'videocam'} size={28} color={callState.isVideoOff ? '#FF3B30' : '#fff'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlButton} onPress={handleSwitchCamera}>
                <Ionicons name="camera-reverse" size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.endCallButton, { backgroundColor: '#FF3B30' }]} onPress={endCall}>
                <Ionicons name="call" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={[styles.callActionButton, { backgroundColor: '#FF3B30' }]} onPress={declineCall}>
                  <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.callActionButton, { backgroundColor: '#2ed573' }]} onPress={acceptCall}>
                  <Ionicons name="call" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
              <Text style={styles.actionLabel}>Slide to decline</Text>
            </>
          )}
        </View>

        <View style={styles.challengeInfo}>
          <Text style={styles.challengeTitle}>{challenge?.title || 'Challenge Verification'}</Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  callerInfo: { alignItems: 'center', paddingTop: 60 },
  callerAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#8e44ad', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  callerAvatarText: { fontSize: 40, fontWeight: 'bold', color: '#fff' },
  callerName: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  callType: { fontSize: 16, color: '#999' },
  videoArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  videoPreview: { width: SCREEN_WIDTH - 40, height: SCREEN_HEIGHT * 0.4, backgroundColor: '#1a1a1a', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  videoPlaceholderText: { color: '#666', fontSize: 16, marginTop: 12 },
  callIdText: { color: '#444', fontSize: 12, marginTop: 8 },
  durationBadge: { position: 'absolute', top: 20, left: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  durationText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  incomingCallView: { alignItems: 'center' },
  ringContainer: { width: 180, height: 180, justifyContent: 'center', alignItems: 'center' },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: 'rgba(142, 68, 173, 0.3)' },
  ringMiddle: { width: 150, height: 150, borderRadius: 75 },
  ringActive: { borderColor: '#8e44ad' },
  ringActiveMiddle: { borderColor: 'rgba(142, 68, 173, 0.5)' },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#8e44ad', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 40, fontWeight: 'bold', color: '#fff' },
  actionsArea: { alignItems: 'center', paddingVertical: 30 },
  controlsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16 },
  actionsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 40, marginBottom: 20 },
  callActionButton: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
  controlButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  controlButtonActive: { backgroundColor: 'rgba(255,255,255,0.4)' },
  endCallButton: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { color: '#999', fontSize: 14 },
  challengeInfo: { alignItems: 'center', paddingBottom: 20 },
  challengeTitle: { color: '#666', fontSize: 14 },
});
