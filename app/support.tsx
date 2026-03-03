import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Image, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useState } from 'react';

const ISSUE_CATEGORIES = [
  'Account Issue',
  'Challenge Problem',
  'Payment Issue',
  'Bug Report',
  'Feature Request',
  'Other',
];

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddImage = () => {
    // In a real app, this would open an image picker
    // For demo, we'll add a placeholder image
    if (images.length >= 3) {
      Alert.alert('Limit Reached', 'You can upload up to 3 images');
      return;
    }
    
    // Adding demo images
    const demoImages = [
      'https://via.placeholder.com/150/007AFF/FFFFFF?text=Image+1',
      'https://via.placeholder.com/150/FF3B30/FFFFFF?text=Image+2',
      'https://via.placeholder.com/150/34C759/FFFFFF?text=Image+3',
    ];
    
    const newImage = demoImages[images.length];
    setImages([...images, newImage]);
  };

  const handleRemoveImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  const handleSubmit = () => {
    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }
    
    if (!subject.trim()) {
      Alert.alert('Error', 'Please enter a subject');
      return;
    }
    
    if (!description.trim()) {
      Alert.alert('Error', 'Please describe your concern');
      return;
    }
    
    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      Alert.alert(
        'Support Ticket Submitted',
        `Thank you for contacting us! Your ticket has been submitted.\n\nCategory: ${category}\nSubject: ${subject}`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    }, 1500);
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          headerTitle: 'Support',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          presentation: 'modal',
        }} 
      />
      <KeyboardAvoidingView 
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={[styles.scrollView, { paddingTop: insets.top }]}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.title, { color: colors.text }]}>Contact Support</Text>
          <Text style={[styles.subtitle, { color: colors.icon }]}>
            Describe your concern and we'll help you resolve it
          </Text>

          {/* Category Selection */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>Category *</Text>
            <View style={styles.categoryGrid}>
              {ISSUE_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    { 
                      backgroundColor: category === cat ? colors.tint : colorScheme === 'dark' ? '#333' : '#f0f0f0',
                      borderColor: category === cat ? colors.tint : 'transparent',
                    },
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      { color: category === cat ? '#fff' : colors.text },
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Subject Input */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>Subject *</Text>
            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: colorScheme === 'dark' ? '#333' : '#f0f0f0',
                  color: colors.text,
                  borderColor: colors.icon + '30',
                },
              ]}
              value={subject}
              onChangeText={setSubject}
              placeholder="Brief description of your issue"
              placeholderTextColor="#999"
              maxLength={100}
            />
          </View>

          {/* Description Input */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>Description *</Text>
            <TextInput
              style={[
                styles.textArea,
                { 
                  backgroundColor: colorScheme === 'dark' ? '#333' : '#f0f0f0',
                  color: colors.text,
                  borderColor: colors.icon + '30',
                },
              ]}
              value={description}
              onChangeText={setDescription}
              placeholder="Please provide details about your concern..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <Text style={[styles.charCount, { color: colors.icon }]}>
              {description.length}/500
            </Text>
          </View>

          {/* Image Upload */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>
              Attach Images (Optional)
            </Text>
            <Text style={[styles.helperText, { color: colors.icon }]}>
              Upload screenshots or photos to help us understand your issue
            </Text>
            
            <View style={styles.imageGrid}>
              {images.map((image, index) => (
                <View key={index} style={styles.imageContainer}>
                  <Image source={{ uri: image }} style={styles.uploadedImage} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => handleRemoveImage(index)}
                  >
                    <Text style={styles.removeImageText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              
              {images.length < 3 && (
                <TouchableOpacity
                  style={[styles.addImageButton, { borderColor: colors.tint }]}
                  onPress={handleAddImage}
                >
                  <Text style={[styles.addImageIcon, { color: colors.tint }]}>📷</Text>
                  <Text style={[styles.addImageText, { color: colors.tint }]}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: isSubmitting ? colors.icon : colors.tint },
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Submitting...' : 'Submit Support Request'}
            </Text>
          </TouchableOpacity>

          {/* Contact Info */}
          <View style={[styles.contactInfo, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
            <Text style={[styles.contactTitle, { color: colors.text }]}>Other Ways to Reach Us</Text>
            <Text style={[styles.contactText, { color: colors.icon }]}>
              📧 support@dashiki.app
            </Text>
            <Text style={[styles.contactText, { color: colors.icon }]}>
              📞 1-800-DASHIKI
            </Text>
            <Text style={[styles.contactText, { color: colors.icon }]}>
              ⏰ Mon-Fri, 9am-6pm EST
            </Text>
          </View>

          <TouchableOpacity 
            style={[styles.closeButton, { backgroundColor: colors.tint }]}
            onPress={() => router.back()}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  helperText: {
    fontSize: 13,
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  textArea: {
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    minHeight: 120,
  },
  charCount: {
    textAlign: 'right',
    marginTop: 8,
    fontSize: 12,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageContainer: {
    position: 'relative',
  },
  uploadedImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ff3b30',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  addImageText: {
    fontSize: 12,
    fontWeight: '500',
  },
  submitButton: {
    padding: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  contactInfo: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  contactText: {
    fontSize: 14,
    marginBottom: 8,
  },
  closeButton: {
    padding: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
