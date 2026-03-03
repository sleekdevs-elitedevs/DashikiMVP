import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  Alert,
  Switch,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '@/api';
import { profilesApi, Profile } from '@/api/profiles';
import { useAuth } from '@/hooks/useAuth';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

// Default avatar images for selection (fallback options)
const DEFAULT_AVATARS = [
  'https://i.pravatar.cc/150?img=1',
  'https://i.pravatar.cc/150?img=2',
  'https://i.pravatar.cc/150?img=3',
  'https://i.pravatar.cc/150?img=4',
  'https://i.pravatar.cc/150?img=5',
  'https://i.pravatar.cc/150?img=6',
  'https://i.pravatar.cc/150?img=7',
  'https://i.pravatar.cc/150?img=8',
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const { user, loading: authLoading } = useAuth();
  
  // User profile state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Edit state
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editedUsername, setEditedUsername] = useState('');
  
  // Settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [themeOverride, setThemeOverride] = useState<'light' | 'dark' | null>(null);
  
  // Avatar picker modal state
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  
  // Determine effective color scheme
  const effectiveColorScheme = themeOverride === null 
    ? systemColorScheme ?? 'light'
    : themeOverride;
    
  const colors = Colors[effectiveColorScheme];
  
  // Fetch user profile on mount
  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);
  
  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const profileData = await profilesApi.getById(user.id);
      if (profileData) {
        setProfile(profileData);
        setEditedUsername(profileData.username);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };
  
  // Request image picker permissions
  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  };
  
  // Request camera permissions
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  };
  
  // Pick image from gallery
  const pickImage = async () => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Please grant photo library access to select images.');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      await uploadAvatar(result.assets[0].uri);
    }
  };
  
  // Take photo with camera
  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Please grant camera access to take photos.');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      await uploadAvatar(result.assets[0].uri);
    }
  };
  
  // Upload avatar to Supabase storage
  const uploadAvatar = async (uri: string) => {
    if (!user) return;
    
    try {
      setSaving(true);
      
      // Path should be userId/filename for RLS policy to work
      const fileName = `${user.id}/${Date.now()}.jpg`;
      
      // Convert URI to base64 then to bytes (required for React Native)
      const base64Data = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', uri, true);
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
      
      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, bytes, { 
          contentType: 'image/jpeg',
          upsert: true 
        });
      
      if (uploadError) {
        throw uploadError;
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);
      
      // Update profile with new avatar URL
      await updateProfile({ avatar_url: publicUrl });
      setShowAvatarPicker(false);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      Alert.alert('Error', 'Failed to upload avatar. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  // Update profile in database
  const updateProfile = async (updates: { username?: string; avatar_url?: string }) => {
    if (!user) return;
    
    try {
      setSaving(true);
      const updatedProfile = await profilesApi.update(user.id, updates);
      setProfile(updatedProfile);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  // Handle username save
  const handleSaveUsername = async () => {
    if (!editedUsername.trim()) {
      Alert.alert('Error', 'Username cannot be empty');
      return;
    }
    
    if (editedUsername.trim().length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }
    
    // Check if username changed
    if (editedUsername.trim() === profile?.username) {
      setIsEditingUsername(false);
      return;
    }
    
    // Check if username is available
    const isAvailable = await profilesApi.isUsernameAvailable(editedUsername.trim());
    if (!isAvailable) {
      Alert.alert('Error', 'This username is already taken');
      return;
    }
    
    await updateProfile({ username: editedUsername.trim() });
    setIsEditingUsername(false);
  };
  
  // Handle avatar selection from defaults
  const handleSelectDefaultAvatar = async (avatarUrl: string) => {
    await updateProfile({ avatar_url: avatarUrl });
    setShowAvatarPicker(false);
  };
  
  // Handle theme change
  const handleThemeChange = (theme: 'light' | 'dark') => {
    setThemeOverride(theme);
  };
  
  // Handle logout
  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await authApi.signOut();
              if (result.success) {
                authApi.navigateToLogin();
              } else {
                Alert.alert('Error', result.error || 'Failed to logout');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };
  
  // Handle option press
  const handleOptionPress = (option: string) => {
    switch (option) {
      case 'Privacy Policy':
        router.push('/privacy');
        break;
      case 'Terms of Service':
        router.push('/terms');
        break;
      case 'Help Center':
        router.push('/help');
        break;
      case 'About':
        router.push('/about');
        break;
      case 'Support':
        router.push('/support');
        break;
      default:
        Alert.alert(option, `This would open ${option} screen.`);
    }
  };

  // Loading state
  if (authLoading || loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
        <Text style={[styles.loadingText, { color: colors.icon }]}>Loading profile...</Text>
      </View>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <View style={styles.notLoggedIn}>
          <Ionicons name="person-circle-outline" size={80} color={colors.icon} />
          <Text style={[styles.notLoggedInText, { color: colors.text }]}>
            Please login to view your settings
          </Text>
          <TouchableOpacity 
            style={[styles.loginButton, { backgroundColor: colors.tint }]}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={[styles.profileSection, { backgroundColor: colors.background }]}>
          {/* Avatar */}
          <TouchableOpacity 
            style={styles.avatarContainer} 
            onPress={() => setShowAvatarPicker(true)}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="large" color={colors.tint} />
            ) : (
              <>
                <Image 
                  source={{ uri: profile?.avatar_url || 'https://i.pravatar.cc/150?img=1' }} 
                  style={styles.avatar} 
                />
                <View style={[styles.avatarEditBadge, { backgroundColor: colors.tint }]}>
                  <Ionicons name="camera-outline" size={18} color="#fff" />
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* Username */}
          {isEditingUsername ? (
            <View style={styles.usernameEditContainer}>
              <TextInput
                style={[
                  styles.usernameInput,
                  {
                    backgroundColor: systemColorScheme === 'dark' ? '#2a2a2a' : '#f0f0f0',
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                value={editedUsername}
                onChangeText={setEditedUsername}
                placeholder="Enter username"
                placeholderTextColor="#999"
                autoFocus
                maxLength={20}
              />
              <View style={styles.editButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsEditingUsername(false);
                    setEditedUsername(profile?.username || '');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.saveButton, { backgroundColor: colors.tint }]} 
                  onPress={handleSaveUsername}
                  disabled={saving}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.usernameContainer}
              onPress={() => {
                setEditedUsername(profile?.username || '');
                setIsEditingUsername(true);
              }}
            >
              <Text style={[styles.username, { color: colors.text }]}>
                {profile?.username || 'Set Username'}
              </Text>
              <Ionicons name="pencil-outline" size={16} color={colors.icon} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}

          <Text style={[styles.profileHint, { color: colors.icon }]}>
            Tap avatar or username to edit
          </Text>
        </View>

        {/* Settings Section */}
        <View style={[styles.settingsSection, { backgroundColor: colors.background }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Preferences</Text>

          {/* Notifications Toggle */}
          <View style={[styles.settingRow, { borderBottomColor: colors.icon + '30' }]}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={22} color={colors.icon} style={{ marginRight: 12 }} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#767577', true: colors.tint }}
              thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>

          {/* Theme Selection */}
          <View style={[styles.settingRow, { borderBottomColor: colors.icon + '30' }]}>
            <View style={styles.settingLeft}>
              <Ionicons name="color-palette-outline" size={22} color={colors.icon} style={{ marginRight: 12 }} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Theme</Text>
            </View>
            <View style={styles.themeButtons}>
              <TouchableOpacity
                style={[
                  styles.themeButton, 
                  themeOverride === 'light' && { backgroundColor: colors.tint }
                ]}
                onPress={() => handleThemeChange('light')}
              >
                <Ionicons 
                  name="sunny-outline" 
                  size={16} 
                  color={themeOverride === 'light' ? '#fff' : colors.icon} 
                />
                <Text style={[
                  styles.themeButtonText, 
                  themeOverride === 'light' && { color: '#fff' }
                ]}> Light</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.themeButton, 
                  themeOverride === 'dark' && { backgroundColor: colors.tint }
                ]}
                onPress={() => handleThemeChange('dark')}
              >
                <Ionicons 
                  name="moon-outline" 
                  size={16} 
                  color={themeOverride === 'dark' ? '#fff' : colors.icon} 
                />
                <Text style={[
                  styles.themeButtonText, 
                  themeOverride === 'dark' && { color: '#fff' }
                ]}> Dark</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.themeButton, 
                  themeOverride === null && { backgroundColor: colors.tint }
                ]}
                onPress={() => setThemeOverride(null)}
              >
                <Ionicons 
                  name="phone-portrait-outline" 
                  size={16} 
                  color={themeOverride === null ? '#fff' : colors.icon} 
                />
                <Text style={[
                  styles.themeButtonText, 
                  themeOverride === null && { color: '#fff' }
                ]}> System</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Account Section */}
        <View style={[styles.accountSection, { backgroundColor: colors.background }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>

          <TouchableOpacity
            style={[styles.optionRow, { borderBottomColor: colors.icon + '30' }]}
            onPress={() => handleOptionPress('Privacy Policy')}
          >
            <Ionicons name="lock-closed-outline" size={20} color={colors.icon} style={{ marginRight: 12 }} />
            <Text style={[styles.optionText, { color: colors.text }]}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.icon} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionRow, { borderBottomColor: colors.icon + '30' }]}
            onPress={() => handleOptionPress('Terms of Service')}
          >
            <Ionicons name="document-text-outline" size={20} color={colors.icon} style={{ marginRight: 12 }} />
            <Text style={[styles.optionText, { color: colors.text }]}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.icon} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionRow, { borderBottomColor: colors.icon + '30' }]}
            onPress={() => handleOptionPress('Help Center')}
          >
            <Ionicons name="help-circle-outline" size={20} color={colors.icon} style={{ marginRight: 12 }} />
            <Text style={[styles.optionText, { color: colors.text }]}>Help Center</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.icon} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionRow, { borderBottomColor: colors.icon + '30' }]}
            onPress={() => handleOptionPress('About')}
          >
            <Ionicons name="information-circle-outline" size={20} color={colors.icon} style={{ marginRight: 12 }} />
            <Text style={[styles.optionText, { color: colors.text }]}>About</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.icon} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionRow, { borderBottomColor: colors.icon + '30' }]}
            onPress={() => handleOptionPress('Support')}
          >
            <Ionicons name="headset-outline" size={20} color={colors.icon} style={{ marginRight: 12 }} />
            <Text style={[styles.optionText, { color: colors.text }]}>Support</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.icon} />
          </TouchableOpacity>

          <View style={[styles.optionRow, { borderBottomColor: colors.icon + '30' }]}>
            <Ionicons name="phone-portrait-outline" size={20} color={colors.icon} style={{ marginRight: 12 }} />
            <Text style={[styles.optionText, { color: colors.text }]}>Version</Text>
            <Text style={[styles.versionText, { color: colors.icon }]}>1.0.0</Text>
          </View>
        </View>

        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={styles.logoutButtonText}> Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Avatar Picker Modal */}
      <Modal 
        visible={showAvatarPicker} 
        transparent 
        animationType="slide" 
        onRequestClose={() => setShowAvatarPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Choose Avatar</Text>

            {/* Upload Options */}
            <View style={styles.uploadOptions}>
              <TouchableOpacity 
                style={[styles.uploadOption, { backgroundColor: colors.tint }]}
                onPress={takePhoto}
              >
                <Ionicons name="camera-outline" size={24} color="#fff" />
                <Text style={styles.uploadOptionText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.uploadOption, { backgroundColor: colors.tint }]}
                onPress={pickImage}
              >
                <Ionicons name="images-outline" size={24} color="#fff" />
                <Text style={styles.uploadOptionText}>Gallery</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.icon }]}>
              Or choose a default avatar:
            </Text>

            <View style={styles.avatarGrid}>
              {DEFAULT_AVATARS.map((avatarUrl, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.avatarOption, 
                    profile?.avatar_url === avatarUrl && styles.avatarOptionSelected
                  ]}
                  onPress={() => handleSelectDefaultAvatar(avatarUrl)}
                >
                  <Image source={{ uri: avatarUrl }} style={styles.avatarOptionImage} />
                  {profile?.avatar_url === avatarUrl && (
                    <View style={styles.avatarSelectedCheck}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.tint} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={[styles.modalCloseButton, { backgroundColor: colors.tint }]} 
              onPress={() => setShowAvatarPicker(false)}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  notLoggedIn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  notLoggedInText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  loginButton: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 25,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  
  // Profile Section Styles
  profileSection: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 15,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  username: {
    fontSize: 22,
    fontWeight: '600',
    marginRight: 8,
  },
  usernameEditContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  usernameInput: {
    width: '80%',
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    borderWidth: 1,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ccc',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  profileHint: {
    fontSize: 12,
    marginTop: 5,
  },
  
  // Settings Section Styles
  settingsSection: {
    paddingHorizontal: 15,
    paddingTop: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
  },
  themeButtons: {
    flexDirection: 'row',
    gap: 5,
  },
  themeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeButtonText: {
    fontSize: 12,
    color: '#666',
  },
  
  // Account Section Styles
  accountSection: {
    paddingHorizontal: 15,
    paddingTop: 10,
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
  },
  versionText: {
    fontSize: 14,
  },
  
  // Logout Section Styles
  logoutSection: {
    paddingHorizontal: 15,
    paddingTop: 10,
    marginBottom: 20,
  },
  logoutButton: {
    backgroundColor: '#ff3b30',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 15,
  },
  uploadOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
    marginBottom: 20,
  },
  uploadOption: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  uploadOptionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  avatarOption: {
    width: (width - 60) / 4,
    aspectRatio: 1,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  avatarOptionSelected: {
    borderColor: '#007AFF',
  },
  avatarOptionImage: {
    width: '100%',
    height: '100%',
  },
  avatarSelectedCheck: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 122, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
