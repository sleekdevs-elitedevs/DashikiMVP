import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          headerTitle: 'Terms of Service',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          presentation: 'modal',
        }} 
      />
      <ScrollView 
        style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.title, { color: colors.text }]}>Terms of Service</Text>
        <Text style={[styles.lastUpdated, { color: colors.icon }]}>Last updated: January 2025</Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>1. Acceptance of Terms</Text>
          <Text style={[styles.text, { color: colors.icon }]}>
            By accessing and using Dashiki, you accept and agree to be bound by the terms and provision of this agreement.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>2. Use License</Text>
          <Text style={[styles.text, { color: colors.icon }]}>
            Permission is granted to temporarily use Dashiki for personal, non-commercial use only.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>3. User Accounts</Text>
          <Text style={[styles.text, { color: colors.icon }]}>
            You are responsible for maintaining the confidentiality of your account and password.
          </Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• You must be at least 13 years old</Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Provide accurate and complete information</Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Notify us of any unauthorized use</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>4. Challenge Participation</Text>
          <Text style={[styles.text, { color: colors.icon }]}>
            When participating in challenges on Dashiki:
          </Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Follow all challenge rules and guidelines</Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Complete challenges honestly</Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Respect other participants</Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Report any violations or issues</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>5. Prohibited Activities</Text>
          <Text style={[styles.text, { color: colors.icon }]}>
            You may not:
          </Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Use the app for any unlawful purpose</Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Harass, abuse, or harm other users</Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Spam or engage in repetitive behavior</Text>
          <Text style={[styles.bullet, { color: colors.icon }]}>• Attempt to hack or reverse engineer the app</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>6. Disclaimer</Text>
          <Text style={[styles.text, { color: colors.icon }]}>
            Dashiki is provided "as is" without warranty of any kind. We do not guarantee the accuracy or reliability of any content.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>7. Contact Information</Text>
          <Text style={[styles.text, { color: colors.icon }]}>
            For questions about these Terms of Service, please contact us at legal@dashiki.app
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
