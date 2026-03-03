import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal, Pressable, Image, ActivityIndicator, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { profilesApi, Profile } from '@/api/profiles';
import { challengesApi, CreateChallengeInput } from '@/api/challenges';
import { challengeInvitationsApi } from '@/api/challengeInvitations';
import { supabase } from '@/lib/supabase';

type RepeatOption = 'single' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
type AudienceType = 'global' | 'friends';

const REPEAT_OPTIONS: { value: RepeatOption; label: string }[] = [
  { value: 'single', label: 'Single-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const CATEGORY_OPTIONS = [
  { value: 'Fitness', icon: '💪' },
  { value: 'Education', icon: '📚' },
  { value: 'Wellness', icon: '🧘' },
  { value: 'Sustainability', icon: '🌱' },
  { value: 'Finance', icon: '💰' },
  { value: 'Productivity', icon: '⚡' },
  { value: 'Creativity', icon: '🎨' },
  { value: 'Social', icon: '👥' },
];

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

// Calculate multiplier based on entry fee amount
// Higher amounts get lower multipliers to keep rewards reasonable
const calculateMultiplier = (amount: number): number => {
  if (amount <= 5) return 10;      // $0.01 - $5: 10x
  if (amount <= 20) return 7;     // $5.01 - $20: 7x
  if (amount <= 50) return 5;     // $20.01 - $50: 5x
  if (amount <= 100) return 3;    // $50.01 - $100: 3x
  return 2;                       // $100+: 2x
};

// Get tier label for display
const getTierLabel = (amount: number): string => {
  if (amount <= 5) return 'Bronze Tier';
  if (amount <= 20) return 'Silver Tier';
  if (amount <= 50) return 'Gold Tier';
  if (amount <= 100) return 'Platinum Tier';
  return 'Diamond Tier';
};

// Get tier color for display
const getTierColor = (amount: number): string => {
  if (amount <= 5) return '#cd7f32';    // Bronze
  if (amount <= 20) return '#c0c0c0';   // Silver
  if (amount <= 50) return '#ffd700';   // Gold
  if (amount <= 100) return '#e5e4e2';  // Platinum
  return '#b9f2ff';                     // Diamond
};

export default function UploadChallengeScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [currentStage, setCurrentStage] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoRequirements, setVideoRequirements] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState('Easy');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState({ hour: 9, minute: 0 });
  const [endTime, setEndTime] = useState({ hour: 10, minute: 0 });
  const [repeatOption, setRepeatOption] = useState<RepeatOption>('single');
  const [audienceType, setAudienceType] = useState<AudienceType>('global');
  const [selectedFriends, setSelectedFriends] = useState<Profile[]>([]);
  const [entryFee, setEntryFee] = useState('');
  
  // Thumbnail state
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  
  const [availableFriends, setAvailableFriends] = useState<Profile[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [friendsSearchQuery, setFriendsSearchQuery] = useState('');

  // Calculate derived values from entry fee
  const entryFeeAmount = parseFloat(entryFee) || 0;
  const multiplier = calculateMultiplier(entryFeeAmount);
  const potentialReward = entryFeeAmount * multiplier;
  const tierLabel = getTierLabel(entryFeeAmount);
  const tierColor = getTierColor(entryFeeAmount);

  useEffect(() => {
    if (showFriendsModal) {
      fetchFriends();
    }
  }, [showFriendsModal]);

  const fetchFriends = async () => {
    try {
      setLoadingFriends(true);
      const { data: { user } } = await supabase.auth.getUser();
      const friends = await profilesApi.getAll();
      const filtered = friends.filter(f => 
        !selectedFriends.some(sf => sf.id === f.id) && 
        f.id !== user?.id
      );
      setAvailableFriends(filtered);
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoadingFriends(false);
    }
  };

  // Thumbnail upload functions
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions to upload a thumbnail.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setThumbnail(result.assets[0].uri);
    }
  };

  const uploadThumbnail = async (challengeId: string): Promise<string | null> => {
    if (!thumbnail) return null;

    try {
      setThumbnailLoading(true);
      
      const fileName = `thumbnail_${challengeId}_${Date.now()}.jpg`;
      
      const base64Data = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', thumbnail, true);
        xhr.responseType = 'blob';
        xhr.onload = function() {
          if (xhr.status === 200) {
            const reader = new FileReader();
            reader.onloadend = function() {
              const base64 = (reader.result as string).split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(xhr.response);
          } else {
            reject(new Error('Failed to fetch image'));
          }
        };
        xhr.onerror = reject;
        xhr.send();
      });
      
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const { data, error } = await supabase.storage
        .from('challenge-thumbnails')
        .upload(fileName, bytes, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.error('Error uploading thumbnail:', error);
        Alert.alert('Upload Error', 'Failed to upload thumbnail. Please try again.');
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('challenge-thumbnails')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error: any) {
      console.error('Error uploading thumbnail:', error);
      Alert.alert('Upload Error', error.message || 'Failed to upload thumbnail. Please try again.');
      return null;
    } finally {
      setThumbnailLoading(false);
    }
  };

  const removeThumbnail = () => {
    setThumbnail(null);
  };

  const handleNext = () => {
    if (currentStage === 0) {
      if (!title.trim() || !description.trim() || !videoRequirements.trim()) {
        Alert.alert('Missing Fields', 'Please fill in all required fields.');
        return;
      }
      setCurrentStage(1);
    } else if (currentStage === 1) {
      if (repeatOption !== 'single' && selectedDays.length === 0) {
        Alert.alert('Select Days', 'Please select at least one day.');
        return;
      }
      setCurrentStage(2);
    } else if (currentStage === 2) {
      if (audienceType === 'friends' && selectedFriends.length === 0) {
        Alert.alert('Select Friends', 'Please select at least one friend.');
        return;
      }
      setCurrentStage(3);
    } else if (currentStage === 3) {
      if (!entryFee || parseFloat(entryFee) <= 0) {
        Alert.alert('Invalid Entry Fee', 'Please enter a valid entry fee.');
        return;
      }
      handleConfirm();
    }
  };

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to create a challenge.');
        return;
      }

      const formatTimeString = (time: { hour: number; minute: number }) => {
        return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
      };

      const challengeData: CreateChallengeInput = {
        title: title.trim(),
        description: description.trim(),
        difficulty: difficulty as 'Easy' | 'Medium' | 'Hard',
        category: category || 'Fitness',
        status: 'Upcoming',
        entry_fee: parseFloat(entryFee),
        potential_reward: potentialReward,
        video_requirements: videoRequirements.trim(),
        schedule_days: selectedDays.length > 0 ? selectedDays : undefined,
        schedule_repeat: repeatOption !== 'single' ? repeatOption : undefined,
        schedule_start_time: formatTimeString(startTime),
        schedule_end_time: formatTimeString(endTime),
        creator_id: user.id,
        friends: audienceType === 'friends' ? selectedFriends.map(f => f.id) : undefined,
      };

      const createdChallenge = await challengesApi.create(challengeData);
      
      if (thumbnail) {
        const thumbnailUrl = await uploadThumbnail(createdChallenge.id);
        if (thumbnailUrl) {
          await challengesApi.update(createdChallenge.id, { thumbnail_url: thumbnailUrl });
        }
      }
      
      if (audienceType === 'friends' && selectedFriends.length > 0) {
        await challengeInvitationsApi.sendBulkInvitations(
          createdChallenge.id,
          user.id,
          selectedFriends.map(f => f.id),
          `You've been invited to join "${title}"!`
        );
      }
      
      console.log('Challenge created successfully:', createdChallenge);
      
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Error creating challenge:', error);
      Alert.alert('Error', error.message || 'Failed to create challenge. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalClose = () => {
    setShowSuccessModal(false);
    router.back();
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const addFriend = (friend: Profile) => {
    setSelectedFriends(prev => [...prev, friend]);
    setAvailableFriends(prev => prev.filter(f => f.id !== friend.id));
  };

  const removeFriend = (friendId: string) => {
    const friend = selectedFriends.find(f => f.id === friendId);
    if (friend) {
      setSelectedFriends(prev => prev.filter(f => f.id !== friendId));
      setAvailableFriends(prev => [...prev, friend]);
    }
  };

  const getCategoryIcon = (cat: string) => CATEGORY_OPTIONS.find(c => c.value === cat)?.icon || '🎯';

  const formatTime = (time: { hour: number; minute: number }) => {
    return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
  };

  const filteredFriends = availableFriends.filter(f => 
    f.username.toLowerCase().includes(friendsSearchQuery.toLowerCase())
  );

  // Time Picker Modal Component
  const TimePickerModal = ({ visible, onClose, onSelect, initialTime, title: pickerTitle }: { 
    visible: boolean; 
    onClose: () => void; 
    onSelect: (time: { hour: number; minute: number }) => void;
    initialTime: { hour: number; minute: number };
    title: string;
  }) => {
    const [selectedHour, setSelectedHour] = useState(initialTime.hour);
    const [selectedMinute, setSelectedMinute] = useState(initialTime.minute);

    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{pickerTitle}</Text>
            <View style={styles.pickerRow}>
              <View style={styles.pickerColumn}>
                <Text style={[styles.pickerLabel, { color: colors.icon }]}>Hour</Text>
                <ScrollView style={styles.pickerScroll}>
                  {HOURS.map(hour => (
                    <TouchableOpacity key={hour} style={[styles.pickerItem, selectedHour === hour && { backgroundColor: colors.tint }]} onPress={() => setSelectedHour(hour)}>
                      <Text style={[styles.pickerItemText, { color: selectedHour === hour ? '#fff' : colors.text }]}>{String(hour).padStart(2, '0')}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <Text style={[styles.pickerSeparator, { color: colors.text }]}>:</Text>
              <View style={styles.pickerColumn}>
                <Text style={[styles.pickerLabel, { color: colors.icon }]}>Minute</Text>
                <ScrollView style={styles.pickerScroll}>
                  {MINUTES.map(minute => (
                    <TouchableOpacity key={minute} style={[styles.pickerItem, selectedMinute === minute && { backgroundColor: colors.tint }]} onPress={() => setSelectedMinute(minute)}>
                      <Text style={[styles.pickerItemText, { color: selectedMinute === minute ? '#fff' : colors.text }]}>{String(minute).padStart(2, '0')}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={styles.pickerButtons}>
              <TouchableOpacity style={[styles.pickerButton, { borderColor: colors.icon }]} onPress={onClose}>
                <Text style={[styles.pickerButtonText, { color: colors.icon }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pickerButton, { backgroundColor: colors.tint }]} onPress={() => { onSelect({ hour: selectedHour, minute: selectedMinute }); onClose(); }}>
                <Text style={[styles.pickerButtonText, { color: '#fff' }]}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, headerTitle: 'Upload Challenge', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, presentation: 'modal' }} />
      <ScrollView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.progressContainer}>
          {[0, 1, 2, 3].map(step => (
            <View key={step} style={[styles.progressStep, { backgroundColor: step <= currentStage ? colors.tint : '#ddd' }]} />
          ))}
        </View>

        {currentStage === 0 && (
          <View style={styles.content}>
            <Text style={[styles.stageTitle, { color: colors.text }]}>Challenge Details</Text>
            <View style={[styles.sectionCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Title *</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.icon }]} placeholder="Challenge title" placeholderTextColor={colors.icon} value={title} onChangeText={setTitle} />
            </View>
            
            {/* Thumbnail Upload Section */}
            <View style={[styles.sectionCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Thumbnail Image</Text>
              {thumbnail ? (
                <View style={styles.thumbnailContainer}>
                  <Image source={{ uri: thumbnail }} style={styles.thumbnailPreview} />
                  <View style={styles.thumbnailActions}>
                    <TouchableOpacity 
                      style={[styles.thumbnailButton, { backgroundColor: colors.tint }]} 
                      onPress={pickImage}
                      disabled={thumbnailLoading}
                    >
                      {thumbnailLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.thumbnailButtonText}>Change</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.thumbnailButton, styles.thumbnailRemoveButton, { borderColor: colors.icon }]} 
                      onPress={removeThumbnail}
                    >
                      <Text style={[styles.thumbnailButtonText, { color: colors.icon }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity 
                  style={[styles.thumbnailUploadBox, { borderColor: colors.icon, backgroundColor: colors.background }]} 
                  onPress={pickImage}
                >
                  <Ionicons name="image-outline" size={40} color={colors.icon} />
                  <Text style={[styles.thumbnailUploadText, { color: colors.icon }]}>Tap to add thumbnail</Text>
                  <Text style={[styles.thumbnailUploadHint, { color: colors.icon }]}>Recommended: 16:9 ratio</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={[styles.sectionCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Description *</Text>
              <TextInput style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.icon }]} placeholder="Description" placeholderTextColor={colors.icon} multiline value={description} onChangeText={setDescription} />
            </View>
            <View style={[styles.sectionCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Category</Text>
              <TouchableOpacity style={[styles.categorySelector, { backgroundColor: colors.background, borderColor: colors.icon }]} onPress={() => setShowCategoryModal(true)}>
                {category ? <><Text style={styles.categorySelectorIcon}>{getCategoryIcon(category)}</Text><Text style={[styles.categorySelectorText, { color: colors.text }]}>{category}</Text></> : <Text style={[styles.categorySelectorPlaceholder, { color: colors.icon }]}>Select category</Text>}
                <Ionicons name="chevron-forward" size={20} color={colors.icon} />
              </TouchableOpacity>
            </View>
            <View style={[styles.sectionCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Difficulty</Text>
              <View style={styles.difficultyContainer}>
                {['Easy', 'Medium', 'Hard'].map(level => (
                  <TouchableOpacity key={level} onPress={() => setDifficulty(level)} style={[styles.difficultyChip, difficulty === level && { backgroundColor: colors.tint, borderColor: colors.tint }]}>
                    <Text style={[styles.difficultyChipText, { color: difficulty === level ? '#fff' : colors.text }]}>{level}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={[styles.sectionCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Video Requirements *</Text>
              <TextInput style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.icon }]} placeholder="Video proof requirements" placeholderTextColor={colors.icon} multiline value={videoRequirements} onChangeText={setVideoRequirements} />
            </View>
            <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: colors.tint }]} onPress={handleNext}><Text style={styles.txtPrimary}>NEXT</Text></TouchableOpacity>
          </View>
        )}

        {currentStage === 1 && (
          <View style={styles.content}>
            <Text style={[styles.stageTitle, { color: colors.text }]}>Schedule</Text>
            <View style={[styles.sectionCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Days</Text>
              <View style={styles.daysContainer}>
                {DAY_NAMES.map(day => (
                  <TouchableOpacity key={day} onPress={() => toggleDay(day)} style={[styles.dayChip, selectedDays.includes(day) && { backgroundColor: colors.tint, borderColor: colors.tint }]}>
                    <Text style={[styles.dayChipText, { color: selectedDays.includes(day) ? '#fff' : colors.text }]}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={[styles.sectionCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Time</Text>
              <View style={styles.timePickerRow}>
                <Text style={[styles.timePickerLabel, { color: colors.text }]}>Start Time:</Text>
                <TouchableOpacity style={[styles.timePickerButton, { borderColor: colors.icon }]} onPress={() => setShowStartTimePicker(true)}>
                  <Ionicons name="time-outline" size={20} color={colors.icon} />
                  <Text style={[styles.timePickerText, { color: colors.text }]}>{formatTime(startTime)}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.timePickerRow}>
                <Text style={[styles.timePickerLabel, { color: colors.text }]}>End Time:</Text>
                <TouchableOpacity style={[styles.timePickerButton, { borderColor: colors.icon }]} onPress={() => setShowEndTimePicker(true)}>
                  <Ionicons name="time-outline" size={20} color={colors.icon} />
                  <Text style={[styles.timePickerText, { color: colors.text }]}>{formatTime(endTime)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.sectionCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Repeat</Text>
              {REPEAT_OPTIONS.map(opt => (
                <TouchableOpacity key={opt.value} onPress={() => setRepeatOption(opt.value)} style={styles.optionRow}>
                  <View style={[styles.radioOuter, repeatOption === opt.value && { borderColor: colors.tint }]}>
                    {repeatOption === opt.value && <View style={[styles.radioInner, { backgroundColor: colors.tint }]} />}
                  </View>
                  <Text style={[styles.optionLabel, { color: colors.text }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.btnSecondary, { borderColor: colors.icon }]} onPress={() => setCurrentStage(0)}><Text style={[styles.txtSecondary, { color: colors.icon }]}>BACK</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: colors.tint }]} onPress={handleNext}><Text style={styles.txtPrimary}>NEXT</Text></TouchableOpacity>
            </View>
          </View>
        )}

        {currentStage === 2 && (
          <View style={styles.content}>
            <Text style={[styles.stageTitle, { color: colors.text }]}>Choose Audience</Text>
            <View style={[styles.sectionCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
              <TouchableOpacity style={[styles.audienceOption, audienceType === 'global' && { borderColor: colors.tint, backgroundColor: colors.tint + '10' }]} onPress={() => setAudienceType('global')}>
                <Ionicons name="earth" size={32} color={audienceType === 'global' ? colors.tint : colors.icon} />
                <View style={styles.audienceInfo}><Text style={[styles.audienceTitle, { color: colors.text }]}>Global</Text><Text style={[styles.audienceDesc, { color: colors.icon }]}>Anyone can join</Text></View>
                <View style={[styles.radioOuter, audienceType === 'global' && { borderColor: colors.tint }]}>{audienceType === 'global' && <View style={[styles.radioInner, { backgroundColor: colors.tint }]} />}</View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.audienceOption, audienceType === 'friends' && { borderColor: colors.tint, backgroundColor: colors.tint + '10' }]} onPress={() => setAudienceType('friends')}>
                <Ionicons name="people" size={32} color={audienceType === 'friends' ? colors.tint : colors.icon} />
                <View style={styles.audienceInfo}><Text style={[styles.audienceTitle, { color: colors.text }]}>Friends Only</Text><Text style={[styles.audienceDesc, { color: colors.icon }]}>Invite specific friends</Text></View>
                <View style={[styles.radioOuter, audienceType === 'friends' && { borderColor: colors.tint }]}>{audienceType === 'friends' && <View style={[styles.radioInner, { backgroundColor: colors.tint }]} />}</View>
              </TouchableOpacity>
            </View>

            {audienceType === 'friends' && (
              <View style={[styles.sectionCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
                <View style={styles.selectedFriendsHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Selected Friends</Text>
                  <TouchableOpacity onPress={() => setShowFriendsModal(true)}><Text style={[styles.addFriendsButton, { color: colors.tint }]}>+ Add Friends</Text></TouchableOpacity>
                </View>
                {selectedFriends.length > 0 ? (
                  <View style={styles.selectedFriendsList}>
                    {selectedFriends.map(friend => (
                      <View key={friend.id} style={[styles.selectedFriendChip, { backgroundColor: colors.background }]}>
                        {friend.avatar_url ? <Image source={{ uri: friend.avatar_url }} style={styles.selectedFriendAvatar} /> : <View style={[styles.selectedFriendAvatar, { backgroundColor: '#ccc' }]} />}
                        <Text style={[styles.selectedFriendName, { color: colors.text }]}>@{friend.username}</Text>
                        <TouchableOpacity onPress={() => removeFriend(friend.id)}><Ionicons name="close-circle" size={20} color={colors.icon} /></TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <TouchableOpacity style={[styles.selectFriendsButton, { borderColor: colors.tint }]} onPress={() => setShowFriendsModal(true)}>
                    <Ionicons name="person-add" size={24} color={colors.tint} />
                    <Text style={[styles.selectFriendsText, { color: colors.tint }]}>Tap to select friends</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.btnSecondary, { borderColor: colors.icon }]} onPress={() => setCurrentStage(1)}><Text style={[styles.txtSecondary, { color: colors.icon }]}>BACK</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: colors.tint, opacity: audienceType === 'friends' && selectedFriends.length === 0 ? 0.5 : 1 }]} onPress={handleNext} disabled={audienceType === 'friends' && selectedFriends.length === 0}><Text style={styles.txtPrimary}>NEXT</Text></TouchableOpacity>
            </View>
          </View>
        )}

        {currentStage === 3 && (
          <View style={styles.content}>
            <Text style={[styles.stageTitle, { color: colors.text }]}>Reward Setup</Text>
            <View style={[styles.sectionCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Entry Fee ($)</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.icon }]} placeholder="Entry fee" placeholderTextColor={colors.icon} keyboardType="numeric" value={entryFee} onChangeText={setEntryFee} />
            </View>
          
            {/* Dynamic Reward Calculation with Multiplier Display */}
            {entryFee && parseFloat(entryFee) > 0 && (
              <>
                <View style={[styles.calcBox, { backgroundColor: '#f9f9f9' }]}>
                  <View style={styles.multiplierRow}>
                    <Text style={styles.multiplierLabel}>Reward Multiplier:</Text>
                    <View style={styles.multiplierValueContainer}>
                      <Text style={styles.multiplierValue}>{multiplier}x</Text>
                      <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
                        <Text style={styles.tierBadgeText}>{tierLabel}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.rewardRow}>
                    <Text style={styles.calcLabel}>Potential Reward:</Text>
                    <Text style={styles.rewardValue}>${potentialReward.toFixed(2)}</Text>
                  </View>
                </View>
                
                {/* Tier Explanation */}
                <View style={[styles.tierInfoBox, { backgroundColor: colors.tint + '15' }]}>
                  <Text style={[styles.tierInfoTitle, { color: colors.text }]}>💎 Reward Tiers</Text>
                  <Text style={[styles.tierInfoText, { color: colors.icon }]}>
                    $0.01 - $5 → 10x{'\n'}
                    $5.01 - $20 → 7x{'\n'}
                    $20.01 - $50 → 5x{'\n'}
                    $50.01 - $100 → 3x{'\n'}
                    $100+ → 2x
                  </Text>
                </View>
              </>
            )}
            
            <View style={[styles.noticeBox, { backgroundColor: colors.tint + '20' }]}>
              <Text style={[styles.noticeText, { color: colors.text }]}>💰 Participants will be charged this entry fee</Text>
            </View>
            <View style={[styles.sectionCard, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Preview</Text>
              <Text style={[styles.previewTitle, { color: colors.text }]}>{title || 'Title'}</Text>
              <Text style={[styles.previewText, { color: colors.icon }]}>{description || 'Description'}</Text>
              <Text style={[styles.previewLabel, { color: colors.icon }]}>Category: {category || 'Not selected'}</Text>
              <Text style={[styles.previewLabel, { color: colors.icon }]}>Time: {formatTime(startTime)} - {formatTime(endTime)}</Text>
              <Text style={[styles.previewLabel, { color: colors.icon }]}>Audience: {audienceType === 'global' ? 'Global' : `Friends (${selectedFriends.length})`}</Text>
              {entryFee && parseFloat(entryFee) > 0 && (
                <Text style={[styles.previewLabel, { color: colors.icon }]}>Entry Fee: ${entryFee} → Reward: ${potentialReward.toFixed(2)}</Text>
              )}
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.btnSecondary, { borderColor: colors.icon }]} onPress={() => setCurrentStage(2)}><Text style={[styles.txtSecondary, { color: colors.icon }]}>BACK</Text></TouchableOpacity>
              <TouchableOpacity 
                style={[styles.btnPrimary, { backgroundColor: colors.tint, opacity: (!entryFee || parseFloat(entryFee) <= 0 || isLoading) ? 0.5 : 1 }]} 
                onPress={handleConfirm} 
                disabled={!entryFee || parseFloat(entryFee) <= 0 || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.txtPrimary}>UPLOAD</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Time Pickers */}
      <TimePickerModal visible={showStartTimePicker} onClose={() => setShowStartTimePicker(false)} onSelect={setStartTime} initialTime={startTime} title="Select Start Time" />
      <TimePickerModal visible={showEndTimePicker} onClose={() => setShowEndTimePicker(false)} onSelect={setEndTime} initialTime={endTime} title="Select End Time" />

      {/* Category Modal */}
      <Modal visible={showCategoryModal} transparent animationType="slide" onRequestClose={() => setShowCategoryModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCategoryModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Category</Text>
            <ScrollView style={styles.categoryScroll}>
              {CATEGORY_OPTIONS.map(opt => (
                <TouchableOpacity key={opt.value} style={[styles.categoryOption, category === opt.value && { backgroundColor: colors.tint + '20' }]} onPress={() => { setCategory(opt.value); setShowCategoryModal(false); }}>
                  <Text style={styles.categoryIcon}>{opt.icon}</Text>
                  <Text style={[styles.categoryLabel, { color: colors.text }]}>{opt.value}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.tint }]} onPress={() => setShowCategoryModal(false)}><Text style={styles.modalButtonText}>Done</Text></TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Friends Selection Modal */}
      <Modal visible={showFriendsModal} transparent animationType="slide" onRequestClose={() => setShowFriendsModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowFriendsModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Friends</Text>
            <View style={[styles.searchBar, { backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#f0f0f0' }]}>
              <Ionicons name="search" size={20} color={colors.icon} />
              <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Search friends..." placeholderTextColor={colors.icon} value={friendsSearchQuery} onChangeText={setFriendsSearchQuery} />
            </View>
            {loadingFriends ? <ActivityIndicator size="large" color={colors.tint} style={styles.loadingFriends} /> : (
              <ScrollView style={styles.friendsList}>
                {filteredFriends.length > 0 ? filteredFriends.map(friend => (
                  <TouchableOpacity key={friend.id} style={[styles.friendOption, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]} onPress={() => addFriend(friend)}>
                    {friend.avatar_url ? <Image source={{ uri: friend.avatar_url }} style={styles.friendAvatar} /> : <View style={[styles.friendAvatar, { backgroundColor: '#ccc' }]} />}
                    <Text style={[styles.friendName, { color: colors.text }]}>@{friend.username}</Text>
                    <Ionicons name="add-circle-outline" size={24} color={colors.tint} />
                  </TouchableOpacity>
                )) : <Text style={[styles.noFriendsText, { color: colors.icon }]}>No friends found</Text>}
              </ScrollView>
            )}
            <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.tint }]} onPress={() => setShowFriendsModal(false)}><Text style={styles.modalButtonText}>Done</Text></TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade" onRequestClose={handleModalClose}>
        <Pressable style={styles.modalOverlay} onPress={handleModalClose}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <Ionicons name="checkmark-circle" size={80} color="#2ed573" />
            <Text style={[styles.modalTitle, { color: colors.text }]}>🎉 Challenge Uploaded!</Text>
            <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.tint }]} onPress={handleModalClose}><Text style={styles.modalButtonText}>Go to Challenges</Text></TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 50 },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 20, gap: 8 },
  progressStep: { width: 60, height: 6, borderRadius: 3 },
  stageTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  sectionCard: { borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  categorySelector: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 12 },
  categorySelectorIcon: { fontSize: 20, marginRight: 10 },
  categorySelectorText: { flex: 1, fontSize: 16 },
  categorySelectorPlaceholder: { flex: 1, fontSize: 16 },
  categoryScroll: { maxHeight: 300, marginBottom: 16 },
  categoryOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 8 },
  categoryIcon: { fontSize: 28, marginRight: 12 },
  categoryLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
  difficultyContainer: { flexDirection: 'row', gap: 8 },
  difficultyChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#ddd' },
  difficultyChipText: { fontSize: 14, fontWeight: '500' },
  daysContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd' },
  dayChipText: { fontSize: 14, fontWeight: '500' },
  timePickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  timePickerLabel: { fontSize: 14, fontWeight: '500' },
  timePickerButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  timePickerText: { fontSize: 16, fontWeight: '500' },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  optionLabel: { fontSize: 14 },
  audienceOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 2, borderColor: 'transparent', marginBottom: 12 },
  audienceInfo: { flex: 1, marginLeft: 12 },
  audienceTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  audienceDesc: { fontSize: 14 },
  selectedFriendsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addFriendsButton: { fontSize: 14, fontWeight: '600' },
  selectedFriendsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectedFriendChip: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 20, gap: 8 },
  selectedFriendAvatar: { width: 24, height: 24, borderRadius: 12 },
  selectedFriendName: { fontSize: 14 },
  selectFriendsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', gap: 8 },
  selectFriendsText: { fontSize: 14, fontWeight: '600' },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginBottom: 16, gap: 8 },
  searchInput: { flex: 1, fontSize: 16 },
  loadingFriends: { paddingVertical: 40 },
  friendsList: { maxHeight: 250 },
  friendOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 8 },
  friendAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  friendName: { flex: 1, fontSize: 16, fontWeight: '500' },
  noFriendsText: { textAlign: 'center', paddingVertical: 20 },
  calcBox: { padding: 16, borderRadius: 8, marginBottom: 16 },
  calcLabel: { fontSize: 16, fontWeight: '600' },
  multiplierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  multiplierLabel: { fontSize: 14, fontWeight: '500', color: '#666' },
  multiplierValueContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  multiplierValue: { fontSize: 20, fontWeight: 'bold', color: '#2ed573' },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  tierBadgeText: { fontSize: 10, fontWeight: '600', color: '#333' },
  rewardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rewardValue: { fontSize: 24, fontWeight: 'bold', color: '#2ed573' },
  tierInfoBox: { padding: 12, borderRadius: 8, marginBottom: 16 },
  tierInfoTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  tierInfoText: { fontSize: 12, lineHeight: 18 },
  noticeBox: { padding: 16, borderRadius: 12, marginBottom: 20 },
  noticeText: { fontSize: 14 },
  previewTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  previewText: { fontSize: 14, marginBottom: 8 },
  previewLabel: { fontSize: 14, marginBottom: 4 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  btnPrimary: { flex: 1, paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginBottom: 12 },
  txtPrimary: { color: '#fff', fontSize: 18, fontWeight: '600' },
  btnSecondary: { flex: 1, paddingVertical: 16, borderRadius: 30, alignItems: 'center', borderWidth: 1, marginBottom: 12 },
  txtSecondary: { fontSize: 16, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 340, borderRadius: 24, padding: 20 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#ccc', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  modalButton: { paddingVertical: 14, borderRadius: 20, alignItems: 'center' },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  pickerColumn: { flex: 1, alignItems: 'center' },
  pickerLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  pickerScroll: { height: 150, width: '100%' },
  pickerItem: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', marginVertical: 2 },
  pickerItemText: { fontSize: 18, fontWeight: '500' },
  pickerSeparator: { fontSize: 24, fontWeight: 'bold', marginHorizontal: 10 },
  pickerButtons: { flexDirection: 'row', gap: 12 },
  pickerButton: { flex: 1, paddingVertical: 12, borderRadius: 20, alignItems: 'center', borderWidth: 1 },
  pickerButtonText: { fontSize: 16, fontWeight: '600' },
  // Thumbnail styles
  thumbnailContainer: { alignItems: 'center' },
  thumbnailPreview: { width: '100%', height: 180, borderRadius: 12, marginBottom: 12 },
  thumbnailActions: { flexDirection: 'row', gap: 12 },
  thumbnailButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, minWidth: 100, alignItems: 'center' },
  thumbnailRemoveButton: { borderWidth: 1, backgroundColor: 'transparent' },
  thumbnailButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  thumbnailUploadBox: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, padding: 30, gap: 8 },
  thumbnailUploadText: { fontSize: 16, fontWeight: '500' },
  thumbnailUploadHint: { fontSize: 12 },
});
