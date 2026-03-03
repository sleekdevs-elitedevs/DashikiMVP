import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal, Pressable, Image, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { proofsApi } from '@/api/proofs';
import { participantsApi } from '@/api/participants';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SelectedMedia {
  uri: string;
  type: 'image' | 'video';
  duration?: number;
}

export default function SubmitProofScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { id: challengeId } = useLocalSearchParams<{ id: string }>();
  
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      Alert.alert('Permissions Required', 'Please grant camera and photo library permissions to upload proof.', [{ text: 'OK' }]);
      return false;
    }
    return true;
  };

  const pickImages = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10 - selectedMedia.length,
      });

      if (!result.canceled && result.assets) {
        const newImages: SelectedMedia[] = result.assets.map(asset => ({ uri: asset.uri, type: 'image' as const }));
        setSelectedMedia(prev => [...prev, ...newImages].slice(0, 10));
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const pickVideo = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsMultipleSelection: false,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.duration && asset.duration > 60) {
          Alert.alert('Video Too Long', 'Please select a video that is 1 minute or less.');
          return;
        }
        if (selectedMedia.length >= 10) {
          Alert.alert('Maximum Reached', 'You can only upload up to 10 media files.');
          return;
        }
        setSelectedMedia(prev => [...prev, { uri: asset.uri, type: 'video', duration: asset.duration || 0 }]);
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video. Please try again.');
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10 - selectedMedia.length,
      });

      if (!result.canceled && result.assets) {
        const newImages: SelectedMedia[] = result.assets.map(asset => ({ uri: asset.uri, type: 'image' as const }));
        setSelectedMedia(prev => [...prev, ...newImages].slice(0, 10));
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const takeVideo = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        allowsMultipleSelection: false,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.duration && asset.duration > 60) {
          Alert.alert('Video Too Long', 'Please record a video that is 1 minute or less.');
          return;
        }
        if (selectedMedia.length >= 10) {
          Alert.alert('Maximum Reached', 'You can only upload up to 10 media files.');
          return;
        }
        setSelectedMedia(prev => [...prev, { uri: asset.uri, type: 'video', duration: asset.duration || 0 }]);
      }
    } catch (error) {
      console.error('Error recording video:', error);
      Alert.alert('Error', 'Failed to record video. Please try again.');
    }
  };

  const removeMedia = (index: number) => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFile = async (uri: string, fileType: 'image' | 'video'): Promise<string> => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');

    const extension = uri.split('.').pop() || (fileType === 'video' ? 'mp4' : 'jpg');
    const fileName = `${userId}/${challengeId}/${Date.now()}.${extension}`;
    const contentType = fileType === 'video' ? 'video/mp4' : 'image/jpeg';

    const { data, error } = await supabase.storage.from('challenge-proofs').upload(fileName, { uri, type: contentType } as any, { contentType, upsert: false });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage.from('challenge-proofs').getPublicUrl(fileName);
    return publicUrl;
  };

  const handleSubmit = async () => {
    if (selectedMedia.length === 0) {
      Alert.alert('No Media Selected', 'Please select at least one image or video as proof.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to submit proof.');
        return;
      }

      const participants = await participantsApi.getByUser(user.id);
      const participant = participants.find(p => p.challenge_id === challengeId);

      if (!participant) {
        Alert.alert('Error', 'You are not participating in this challenge.');
        return;
      }

      const uploadedUrls: { url: string; type: 'video' | 'image' }[] = [];
      
      for (let i = 0; i < selectedMedia.length; i++) {
        const media = selectedMedia[i];
        try {
          const url = await uploadFile(media.uri, media.type);
          uploadedUrls.push({ url, type: media.type });
        } catch (error) {
          console.error(`Error uploading media ${i + 1}:`, error);
        }
        setUploadProgress(Math.round(((i + 1) / selectedMedia.length) * 100));
      }

      if (uploadedUrls.length === 0) {
        Alert.alert('Upload Failed', 'Failed to upload any files. Please try again.');
        return;
      }

      for (const file of uploadedUrls) {
        await proofsApi.create({
          user_id: user.id,
          challenge_id: challengeId,
          participant_id: participant.id,
          file_url: file.url,
          file_type: file.type,
          description: description.trim() || undefined,
        });
      }

      Alert.alert('Proof Submitted! 🎉', `You successfully submitted ${uploadedUrls.length} file(s) as proof.`, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error: any) {
      console.error('Error submitting proof:', error);
      Alert.alert('Error', error.message || 'Failed to submit proof. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, headerTitle: 'Submit Proof', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, presentation: 'modal' }} />
      
      <ScrollView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]} contentContainerStyle={styles.content}>
        <View style={[styles.instructionsCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
          <Text style={[styles.instructionsTitle, { color: colors.text }]}>📸 Submit Your Proof</Text>
          <Text style={[styles.instructionsText, { color: colors.icon }]}>Upload images or a short video (up to 1 minute) showing your challenge completion.</Text>
          <View style={styles.limitRow}>
            <Text style={[styles.limitText, { color: colors.icon }]}>• Max 10 files</Text>
            <Text style={[styles.limitText, { color: colors.icon }]}>• Video: 1 min max</Text>
          </View>
        </View>

        {selectedMedia.length > 0 && (
          <View style={styles.mediaPreviewSection}>
            <View style={styles.mediaPreviewHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Selected Files ({selectedMedia.length}/10)</Text>
              <TouchableOpacity onPress={() => setSelectedMedia([])}><Text style={[styles.clearText, { color: '#FF3B30' }]}>Clear All</Text></TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaScroll}>
              {selectedMedia.map((media, index) => (
                <View key={index} style={styles.mediaPreviewItem}>
                  {media.type === 'image' ? (
                    <Image source={{ uri: media.uri }} style={styles.mediaPreviewImage} />
                  ) : (
                    <View style={[styles.mediaPreviewVideo, { backgroundColor: '#000' }]}>
                      <Ionicons name="videocam" size={32} color="#fff" />
                      <Text style={styles.videoDuration}>{formatDuration(media.duration || 0)}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.removeMediaButton} onPress={() => removeMedia(index)}>
                    <Ionicons name="close-circle" size={24} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}
              {selectedMedia.length < 10 && (
                <TouchableOpacity style={[styles.addMoreButton, { borderColor: colors.tint }]} onPress={() => setShowMediaPicker(true)}>
                  <Ionicons name="add" size={32} color={colors.tint} />
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        )}

        {selectedMedia.length === 0 && (
          <TouchableOpacity style={[styles.addMediaButton, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]} onPress={() => setShowMediaPicker(true)}>
            <Ionicons name="add-circle-outline" size={48} color={colors.tint} />
            <Text style={[styles.addMediaText, { color: colors.text }]}>Tap to add proof</Text>
            <Text style={[styles.addMediaSubtext, { color: colors.icon }]}>Images or video (max 1 min)</Text>
          </TouchableOpacity>
        )}

        <View style={[styles.descriptionSection, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Description (Optional)</Text>
          <TextInput style={[styles.descriptionInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.icon }]} placeholder="Add a description about your progress..." placeholderTextColor={colors.icon} multiline numberOfLines={4} value={description} onChangeText={setDescription} maxLength={500} />
          <Text style={[styles.charCount, { color: colors.icon }]}>{description.length}/500</Text>
        </View>

        <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.tint }, (selectedMedia.length === 0 || isUploading) && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={selectedMedia.length === 0 || isUploading}>
          {isUploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.uploadProgressText}>Uploading... {uploadProgress}%</Text>
            </View>
          ) : (
            <>
              <Ionicons name="cloud-upload" size={24} color="#fff" />
              <Text style={styles.submitButtonText}>Submit Proof</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.cancelButton, { borderColor: colors.icon }]} onPress={() => router.back()}>
          <Text style={[styles.cancelButtonText, { color: colors.icon }]}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showMediaPicker} transparent animationType="slide" onRequestClose={() => setShowMediaPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowMediaPicker(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Media</Text>
            <View style={styles.pickerOptions}>
              <TouchableOpacity style={[styles.pickerOption, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]} onPress={() => { setShowMediaPicker(false); takePhoto(); }}>
                <View style={[styles.pickerIcon, { backgroundColor: '#FF6B6B' }]}><Ionicons name="camera" size={24} color="#fff" /></View>
                <View style={styles.pickerInfo}><Text style={[styles.pickerTitle, { color: colors.text }]}>Take Photo</Text><Text style={[styles.pickerDesc, { color: colors.icon }]}>Use camera to capture</Text></View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pickerOption, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]} onPress={() => { setShowMediaPicker(false); takeVideo(); }}>
                <View style={[styles.pickerIcon, { backgroundColor: '#FF9F43' }]}><Ionicons name="videocam" size={24} color="#fff" /></View>
                <View style={styles.pickerInfo}><Text style={[styles.pickerTitle, { color: colors.text }]}>Record Video</Text><Text style={[styles.pickerDesc, { color: colors.icon }]}>Max 1 minute</Text></View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pickerOption, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]} onPress={() => { setShowMediaPicker(false); pickImages(); }}>
                <View style={[styles.pickerIcon, { backgroundColor: '#54A0FF' }]}><Ionicons name="images" size={24} color="#fff" /></View>
                <View style={styles.pickerInfo}><Text style={[styles.pickerTitle, { color: colors.text }]}>Choose Images</Text><Text style={[styles.pickerDesc, { color: colors.icon }]}>Select from photo library</Text></View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pickerOption, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]} onPress={() => { setShowMediaPicker(false); pickVideo(); }}>
                <View style={[styles.pickerIcon, { backgroundColor: '#5F27CD' }]}><Ionicons name="film" size={24} color="#fff" /></View>
                <View style={styles.pickerInfo}><Text style={[styles.pickerTitle, { color: colors.text }]}>Choose Video</Text><Text style={[styles.pickerDesc, { color: colors.icon }]}>Select from video library</Text></View>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.modalCancelButton, { borderColor: colors.icon }]} onPress={() => setShowMediaPicker(false)}><Text style={[styles.modalCancelText, { color: colors.icon }]}>Cancel</Text></TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  instructionsCard: { borderRadius: 16, padding: 20, marginBottom: 20 },
  instructionsTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  instructionsText: { fontSize: 14, lineHeight: 20 },
  limitRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  limitText: { fontSize: 12 },
  mediaPreviewSection: { marginBottom: 20 },
  mediaPreviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  clearText: { fontSize: 14, fontWeight: '500' },
  mediaScroll: { flexDirection: 'row' },
  mediaPreviewItem: { marginRight: 12, position: 'relative' },
  mediaPreviewImage: { width: 100, height: 100, borderRadius: 12 },
  mediaPreviewVideo: { width: 100, height: 100, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  videoDuration: { color: '#fff', fontSize: 12, marginTop: 4 },
  removeMediaButton: { position: 'absolute', top: -8, right: -8 },
  addMoreButton: { width: 100, height: 100, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  addMediaButton: { borderRadius: 16, padding: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  addMediaText: { fontSize: 18, fontWeight: '600', marginTop: 12 },
  addMediaSubtext: { fontSize: 14, marginTop: 4 },
  descriptionSection: { borderRadius: 16, padding: 16, marginBottom: 24 },
  descriptionInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16, minHeight: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 8 },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 30, gap: 8, marginBottom: 12 },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  uploadingContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  uploadProgressText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  cancelButton: { padding: 16, borderRadius: 30, alignItems: 'center', borderWidth: 1 },
  cancelButtonText: { fontSize: 16, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { width: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#ccc', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  pickerOptions: { gap: 12 },
  pickerOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12 },
  pickerIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  pickerInfo: { marginLeft: 16, flex: 1 },
  pickerTitle: { fontSize: 16, fontWeight: '600' },
  pickerDesc: { fontSize: 14, marginTop: 2 },
  modalCancelButton: { marginTop: 20, padding: 16, borderRadius: 30, alignItems: 'center', borderWidth: 1 },
  modalCancelText: { fontSize: 16, fontWeight: '500' },
});
