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
  createOrJoinCall, 
  joinCall, 
  leaveCall, 
  toggleMic, 
  toggleCamera, 
  switchCamera,
  generateVerificationCallId,
  STREAM_API_KEY 
} from '@/video-calling-utilities';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CallState {
  isConnecting: boolean;
  isConnected: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  duration: number;
  callId: string | null;
}

export default function VideoVerifyScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { id: challengeId, mode } = useLocalSearchParams<{ id: string; mode: string }>();
  
  const isCreator = mode === 'creator';
  
  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<any>(null);
  const [participant, setParticipant] = useState<any>(null);
  const [userName, setUserName] = useState<string>('');
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<any>(null);
  const [callState, setCallState] = useState<CallState>({
    isConnecting: false,
    isConnected: false,
    isMuted: false,
    isVideoOff: false,
    duration: 0,
    callId: null,
  });
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const initializeVideoClient = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert('Error', 'You must be logged in to verify.', [
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
        setUserName(name);

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
        }

        const participants = await participantsApi.getByUser(user.id);
        const participantData = participants.find((p: any) => p.challenge_id === challengeId);
        
        if (!participantData && !isCreator) {
          Alert.alert('Error', 'You are not participating in this challenge.', [
            { text: 'OK', onPress: () => router.back() }
          ]);
          return;
        }

        if (participantData) {
          setParticipant(participantData);
        }
        
        await requestPermissions();
        
      } catch (error: any) {
        console.error('Error initializing verification:', error);
        Alert.alert('Error', error.message || 'Failed to initialize verification.');
      } finally {
        setLoading(false);
      }
    };

    initializeVideoClient();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (call) {
        leaveCall(call).catch(console.error);
      }
      if (client) {
        client.disconnectUser().catch(console.error);
      }
    };
  }, [challengeId, isCreator]);

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
    } catch (error) {
      console.log('Could not fetch token from backend');
    }
    return "YOUR_STREAM_TOKEN_HERE";
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const cameraPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'This app needs access to your camera for video verification.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        const micPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'This app needs access to your microphone for audio verification.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (cameraPermission !== PermissionsAndroid.RESULTS.GRANTED || 
            micPermission !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Permissions Required',
            'Camera and microphone permissions are required for video verification.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
          return false;
        }
      } catch (err) {
        console.warn(err);
      }
    }
    return true;
  };

  const startCall = async () => {
    if (!client) {
      Alert.alert('Error', 'Video client not initialized');
      return;
    }

    setCallState(prev => ({ ...prev, isConnecting: true }));

    try {
      const callId = generateVerificationCallId(challengeId || '');
      
      let videoCall;
      if (isCreator) {
        videoCall = await createOrJoinCall(client, callId);
      } else {
        videoCall = await joinCall(client, callId);
      }

      setCall(videoCall);
      setCallState(prev => ({ 
        ...prev, 
        isConnecting: false, 
        isConnected: true,
        callId: callId 
      }));

      timerRef.current = setInterval(() => {
        setCallState(prev => ({
          ...prev,
          duration: prev.duration + 1,
        }));
      }, 1000);

    } catch (error: any) {
      console.error('Error starting call:', error);
      setCallState(prev => ({ ...prev, isConnecting: false }));
      Alert.alert('Error', 'Failed to start video call: ' + error.message);
    }
  };

  const handleToggleMute = async () => {
    if (!call) return;
    try {
      await toggleMic(call, callState.isMuted);
      setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const handleToggleVideo = async () => {
    if (!call) return;
    try {
      await toggleCamera(call, callState.isVideoOff);
      setCallState(prev => ({ ...prev, isVideoOff: !prev.isVideoOff }));
    } catch (error) {
      console.error('Error toggling video:', error);
    }
  };

  const handleSwitchCamera = async () => {
    if (!call) return;
    try {
      await switchCamera(call);
    } catch (error) {
      console.error('Error switching camera:', error);
    }
  };

  const endCall = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (call) {
      try {
        await leaveCall(call);
      } catch (error) {
        console.error('Error leaving call:', error);
      }
    }

    const MIN_DURATION = 30;

    if (callState.duration < MIN_DURATION) {
      Alert.alert(
        'Verification Too Short',
        `You need to be on the call for at least ${MIN_DURATION} seconds to complete verification. Your call was ${callState.duration} seconds.`,
        [{ text: 'OK' }]
      );
      router.back();
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Session expired. Please try again.');
        router.back();
        return;
      }

      let participantId = participant?.id;
      if (!participantId) {
        const participants = await participantsApi.getByUser(user.id);
        const part = participants.find((p: any) => p.challenge_id === challengeId);
        participantId = part?.id;
      }

      const verificationProof = {
        user_id: user.id,
        challenge_id: challengeId,
        participant_id: participantId || '',
        file_url: `stream-call-${callState.callId}`,
        file_type: 'video' as const,
        description: `${isCreator ? 'Creator' : 'Participant'} live video verification call - Duration: ${formatDuration(callState.duration)}`,
      };

      await proofsApi.create(verificationProof);

      // Navigate to call summary page
      router.replace({
        pathname: '/challenge/call-summary/[id]',
        params: { 
          id: challengeId,
          duration: callState.duration.toString(),
          callId: callState.callId || ''
        }
      });
    } catch (error: any) {
      console.error('Error saving verification:', error);
      Alert.alert('Error', 'Failed to save verification. Please try again.');
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
          <Text style={[styles.loadingText, { color: colors.text }]}>Preparing verification...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          headerTitle: isCreator ? 'Start Verification Call' : 'Join Verification Call',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <View style={[styles.container, { backgroundColor: '#000', paddingTop: insets.top }]}>
        <View style={styles.challengeInfo}>
          <Text style={styles.challengeTitle}>{challenge?.title || 'Challenge Verification'}</Text>
          <Text style={styles.challengeSubtitle}>
            {isCreator 
              ? 'Start a verification call to check on participants'
              : 'Join the verification call with the challenge creator'}
          </Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {isCreator ? '👑 Creator' : '🏃 Participant'}
            </Text>
          </View>
        </View>

        <View style={styles.videoArea}>
          {callState.isConnected ? (
            <>
              <View style={styles.videoPreview}>
                <Ionicons name="person" size={80} color="#666" />
                <Text style={styles.videoPlaceholderText}>
                  {callState.isVideoOff ? 'Camera Off' : 'Live Video - Stream Connected'}
                </Text>
                <Text style={styles.callIdText}>
                  Call ID: {callState.callId}
                </Text>
              </View>
              
              <View style={styles.durationBadge}>
                <Ionicons name="videocam" size={14} color="#fff" />
                <Text style={styles.durationText}>{formatDuration(callState.duration)}</Text>
              </View>
            </>
          ) : (
            <View style={styles.preCallView}>
              <View style={styles.preCallIcon}>
                <Ionicons name={isCreator ? "videocam" : "call"} size={64} color={colors.tint} />
              </View>
              <Text style={styles.preCallTitle}>
                {callState.isConnecting ? 'Connecting...' : (isCreator ? 'Ready to Start' : 'Ready to Join')}
              </Text>
              <Text style={styles.preCallText}>
                {callState.isConnecting 
                  ? 'Please wait while we connect you...' 
                  : (isCreator 
                      ? 'Start a live video call to verify participants'
                      : 'Join the live video call with the challenge creator')}
              </Text>
              
              {!callState.isConnecting && (
                <TouchableOpacity 
                  style={[styles.startButton, { backgroundColor: colors.tint }]}
                  onPress={startCall}
                >
                  <Ionicons name={isCreator ? "videocam" : "call"} size={24} color="#fff" />
                  <Text style={styles.startButtonText}>
                    {isCreator ? ' Start Verification Call' : 'Join Verification Call'}
                  </Text>
                </TouchableOpacity>
              )}
              
              {callState.isConnecting && (
                <ActivityIndicator size="large" color={colors.tint} />
              )}
            </View>
          )}
        </View>

        {callState.isConnected && (
          <View style={[styles.controlsArea, { paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity 
              style={[styles.controlButton, callState.isMuted && styles.controlButtonActive]}
              onPress={handleToggleMute}
            >
              <Ionicons 
                name={callState.isMuted ? 'mic-off' : 'mic'} 
                size={28} 
                color={callState.isMuted ? '#FF3B30' : '#fff'} 
              />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.controlButton, callState.isVideoOff && styles.controlButtonActive]}
              onPress={handleToggleVideo}
            >
              <Ionicons 
                name={callState.isVideoOff ? 'videocam-off' : 'videocam'} 
                size={28} 
                color={callState.isVideoOff ? '#FF3B30' : '#fff'} 
              />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.controlButton}
              onPress={handleSwitchCamera}
            >
              <Ionicons name="camera-reverse" size={28} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.endCallButton, { backgroundColor: '#FF3B30' }]}
              onPress={endCall}
            >
              <Ionicons name="call" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {!callState.isConnected && !callState.isConnecting && (
          <View style={styles.instructionsArea}>
            <View style={styles.instructionCard}>
              <Ionicons name="information-circle" size={24} color={colors.tint} />
              <Text style={styles.instructionTitle}>How it works</Text>
            </View>
            <View style={styles.instructionList}>
              {isCreator ? (
                <>
                  <View style={styles.instructionItem}>
                    <Text style={styles.instructionNumber}>1</Text>
                    <Text style={styles.instructionText}>Start a live video call</Text>
                  </View>
                  <View style={styles.instructionItem}>
                    <Text style={styles.instructionNumber}>2</Text>
                    <Text style={styles.instructionText}>Wait for participants to join</Text>
                  </View>
                  <View style={styles.instructionItem}>
                    <Text style={styles.instructionNumber}>3</Text>
                    <Text style={styles.instructionText}>Verify each participant's completion</Text>
                  </View>
                  <View style={styles.instructionItem}>
                    <Text style={styles.instructionNumber}>4</Text>
                    <Text style={styles.instructionText}>End call to save verification</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.instructionItem}>
                    <Text style={styles.instructionNumber}>1</Text>
                    <Text style={styles.instructionText}>Join the call when creator starts it</Text>
                  </View>
                  <View style={styles.instructionItem}>
                    <Text style={styles.instructionNumber}>2</Text>
                    <Text style={styles.instructionText}>Show yourself completing the challenge</Text>
                  </View>
                  <View style={styles.instructionItem}>
                    <Text style={styles.instructionNumber}>3</Text>
                    <Text style={styles.instructionText}>Stay on call for at least 30 seconds</Text>
                  </View>
                  <View style={styles.instructionItem}>
                    <Text style={styles.instructionNumber}>4</Text>
                    <Text style={styles.instructionText}>End the call to submit your proof</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  headerButton: { padding: 8 },
  challengeInfo: { padding: 20, alignItems: 'center' },
  challengeTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  challengeSubtitle: { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 8 },
  roleBadge: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  roleBadgeText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  videoArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  videoPreview: { width: SCREEN_WIDTH - 40, height: SCREEN_HEIGHT * 0.5, backgroundColor: '#1a1a1a', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  videoPlaceholderText: { color: '#666', fontSize: 16, marginTop: 12 },
  callIdText: { color: '#444', fontSize: 12, marginTop: 8 },
  durationBadge: { position: 'absolute', top: 20, left: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  durationText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  preCallView: { alignItems: 'center', paddingHorizontal: 40 },
  preCallIcon: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  preCallTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  preCallText: { fontSize: 16, color: '#999', textAlign: 'center', marginBottom: 32, lineHeight: 24 },
  startButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 30, gap: 12 },
  startButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  controlsArea: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 20, gap: 16 },
  controlButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  controlButtonActive: { backgroundColor: 'rgba(255,255,255,0.4)' },
  endCallButton: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
  instructionsArea: { padding: 20 },
  instructionCard: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  instructionTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  instructionList: { gap: 12 },
  instructionItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  instructionNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', textAlign: 'center', lineHeight: 28, color: '#fff', fontWeight: '600', fontSize: 14 },
  instructionText: { flex: 1, color: '#999', fontSize: 14 },
});
