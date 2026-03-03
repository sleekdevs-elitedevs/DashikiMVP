import { StreamVideoClient, StreamVideo, Call } from "@stream-io/video-react-native-sdk";
import { Platform } from "react-native";
import { mediaDevices } from 'react-native-webrtc';

// Stream Video API Key from environment variables
// In production, add EXPO_PUBLIC_STREAM_API_KEY to your .env file
export const STREAM_API_KEY = process.env.EXPO_PUBLIC_STREAM_API_KEY || "";

/**
 * Creates a Stream Video client for the given user
 * @param userId - The unique identifier for the user
 * @param userName - The display name of the user
 * @param userToken - The authentication token from your backend
 * @returns StreamVideoClient instance
 */
export const createVideoClient = (userId: string, userName: string, userToken: string): StreamVideoClient => {
  if (!STREAM_API_KEY) {
    throw new Error("Stream API key is not configured. Please add EXPO_PUBLIC_STREAM_API_KEY to your .env file.");
  }

  const client = new StreamVideoClient({
    apiKey: STREAM_API_KEY,
    user: {
      id: userId,
      name: userName,
    },
    token: userToken,
  });
  
  return client;
};

/**
 * Creates or joins a call session for challenge verification
 * @param client - StreamVideoClient instance
 * @param callId - Unique call identifier
 * @returns Call object
 */
export const createOrJoinCall = async (client: StreamVideoClient, callId: string): Promise<Call> => {
  const call = client.call('default', callId);
  
  await call.join({
    create: true,
    ring: true, // Enable ringing for incoming call notification
  });
  
  return call;
};

/**
 * Joins an existing call
 * @param client - StreamVideoClient instance
 * @param callId - Call identifier to join
 * @returns Call object
 */
export const joinCall = async (client: StreamVideoClient, callId: string): Promise<Call> => {
  const call = client.call('default', callId);
  
  await call.join();
  
  return call;
};

/**
 * Leaves a call
 * @param call - Call object to leave
 */
export const leaveCall = async (call: Call): Promise<void> => {
  await call.leave();
};

/**
 * Toggles the microphone on/off
 * @param call - Call object
 * @param isMuted - Current mute state
 */
export const toggleMic = async (call: Call, isMuted: boolean): Promise<void> => {
  if (isMuted) {
    await call.microphone.enable();
  } else {
    await call.microphone.disable();
  }
};

/**
 * Toggles the camera on/off
 * @param call - Call object
 * @param isVideoOff - Current video state
 */
export const toggleCamera = async (call: Call, isVideoOff: boolean): Promise<void> => {
  if (isVideoOff) {
    await call.camera.enable();
  } else {
    await call.camera.disable();
  }
};

/**
 * Switches between front and back camera
 * @param call - Call object
 */
export const switchCamera = async (call: Call): Promise<void> => {
  // Use flip() method to switch camera
  await call.camera.flip();
};

/**
 * Generates a unique call ID for challenge verification
 * @param challengeId - The challenge ID
 * @returns Call ID string
 */
export const generateVerificationCallId = (challengeId: string): string => {
  const timestamp = Date.now();
  return `challenge-${challengeId}-verify-${timestamp}`;
};

/**
 * Generates a call ID for participants to join
 * @param challengeId - The challenge ID
 * @returns Call ID string
 */
export const getCallIdForChallenge = (challengeId: string): string => {
  return `challenge-${challengeId}-verify`;
};

/**
 * Check if the device has camera hardware
 * @returns Promise<boolean>
 */
export const checkCameraHardware = async (): Promise<boolean> => {
  try {
    const devices = await mediaDevices.enumerateDevices();
    return devices.some((d: any) => d.kind === 'videoinput');
  } catch (error) {
    console.error("Error checking camera hardware:", error);
    return false;
  }
};

/**
 * Check if the device has microphone hardware
 * @returns Promise<boolean>
 */
export const checkMicrophoneHardware = async (): Promise<boolean> => {
  try {
    const devices = await mediaDevices.enumerateDevices();
    return devices.some((d: any) => d.kind === 'audioinput');
  } catch (error) {
    console.error("Error checking microphone hardware:", error);
    return false;
  }
};

/**
 * Check if the device has audio output hardware
 * @returns Promise<boolean>
 */
export const checkAudioOutputHardware = async (): Promise<boolean> => {
  try {
    const devices = await mediaDevices.enumerateDevices();
    // Some platforms may not expose 'audiooutput' — fallback to presence of any audio device
    return devices.some((d: any) => d.kind === 'audiooutput') || devices.some((d: any) => d.kind === 'audioinput');
  } catch (error) {
    console.error("Error checking audio output hardware:", error);
    return false;
  }
};

/**
 * Device hardware check results
 */
export interface DeviceCapabilities {
  hasCamera: boolean;
  hasMicrophone: boolean;
  hasAudioOutput: boolean;
}

/**
 * Check all device capabilities
 * @returns Promise<DeviceCapabilities>
 */
export const checkDeviceCapabilities = async (): Promise<DeviceCapabilities> => {
  const [hasCamera, hasMicrophone, hasAudioOutput] = await Promise.all([
    checkCameraHardware(),
    checkMicrophoneHardware(),
    checkAudioOutputHardware(),
  ]);

  return {
    hasCamera,
    hasMicrophone,
    hasAudioOutput,
  };
};

/**
 * Video call settings
 */
export interface VideoCallSettings {
  video: boolean;
  audio: boolean;
  speakerOn: boolean;
  cameraFacing: 'front' | 'back';
}

/**
 * Default video call settings
 */
export const defaultCallSettings: VideoCallSettings = {
  video: true,
  audio: true,
  speakerOn: true,
  cameraFacing: 'front',
};

/**
 * Format call duration in MM:SS format
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 */
export const formatCallDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Export Stream Video components for use in screens
export { StreamVideo, StreamVideoClient, Call };
