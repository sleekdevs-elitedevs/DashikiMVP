import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          headerTitle: 'Privacy Policy',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          presentation: 'modal',
        }} 
      />
      <ScrollView 
        style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.title, { color: colors.text }]}>Privacy Policy</Text>
        <Text style={[styles.lastUpdated, { color: colors.icon }]}>Last updated: January 2025</Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>1. Information We Collect</Text>
          <Text style={[styles.text, { color: colors.icon }]}>
            We collect information you provide directly to us, including:
          </Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Account information (username, email)</Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Profile data and preferences</Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Challenge participation data</Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Usage data and analytics</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>2. How We Use Your Information</Text>
          <Text style={[styles.text, { color: colors.icon }]}>
            We use the information we collect to:
          </Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Provide and improve our services</Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Personalize your experience</Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Send you updates and notifications</Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Protect against fraud and abuse</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>3. Data Sharing</Text>
          <Text style={[styles.text, { color: colors.icon }]}>
            We may share your information with:
          </Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Service providers who assist our operations</Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Business partners with your consent</Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Legal authorities when required</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>4. Your Rights</Text>
          <Text style={[styles.text, { color: colors.icon }]}>
            You have the right to:
          </Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Access your personal data</Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Request data correction or deletion</Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Opt-out of data collection</Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Export your data</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>5. Contact Us</Text>
          <Text style={[styles.text, { color: colors.icon }]}>
            If you have any questions about this Privacy Policy, please contact us at support@dashiki.app
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.closeButton, { backgroundColor: colors.tint }]}
          onPress={() => router.back()}
        >
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
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
  lastUpdated: {
    fontSize: 14,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 22,
    marginLeft: 8,
  },
  closeButton: {
    padding: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
