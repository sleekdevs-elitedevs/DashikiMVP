import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const FAQS = [
  {
    question: 'How do I join a challenge?',
    answer: 'Simply tap on any challenge card and click the "Join Challenge" button. You can also browse challenges from the Home or Challenges tab.',
  },
  {
    question: 'How are challenges verified?',
    answer: 'Challenges may require self-reporting, photo evidence, or GPS check-ins depending on the challenge rules. Always follow the specific guidelines for each challenge.',
  },
  {
    question: 'Can I create my own challenge?',
    answer: 'Yes! Tap on the Upload tab to create and publish your own challenge. Make sure to include clear rules and achievable goals.',
  },
  {
    question: 'How do I track my progress?',
    answer: 'Your challenge progress is tracked automatically. Visit the Ledger tab to see all your active and completed challenges.',
  },
  {
    question: 'What happens if I miss a day?',
    answer: 'Each challenge has different rules regarding missed days. Some allow catch-up days while others are stricter. Check the challenge details for specific rules.',
  },
  {
    question: 'How do rewards work?',
    answer: 'Completing challenges earns you points and badges. Rewards vary by challenge and are listed in the challenge details.',
  },
  {
    question: 'Can I leave a challenge?',
    answer: 'Yes, you can leave any challenge at any time. However, leaving before completion means you won\'t receive any rewards.',
  },
  {
    question: 'How do I report a problem?',
    answer: 'If you encounter any issues with a challenge or another user, please contact our support team at help@dashiki.app',
  },
];

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          headerTitle: 'Help Center',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          presentation: 'modal',
        }} 
      />
      <ScrollView 
        style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.title, { color: colors.text }]}>Help Center</Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}>
          Find answers to common questions below
        </Text>

        {FAQS.map((faq, index) => (
          <View 
            key={index} 
            style={[styles.faqItem, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}
          >
            <Text style={[styles.faqQuestion, { color: colors.text }]}>{faq.question}</Text>
            <Text style={[styles.faqAnswer, { color: colors.icon }]}>{faq.answer}</Text>
          </View>
        ))}

        <View style={[styles.contactSection, { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5' }]}>
          <Text style={[styles.contactTitle, { color: colors.text }]}>Still Need Help?</Text>
          <Text style={[styles.contactText, { color: colors.icon }]}>
            Our support team is here to help you with any questions or issues.
          </Text>
          <TouchableOpacity 
            style={[styles.contactButton, { backgroundColor: colors.tint }]}
          >
            <Text style={styles.contactButtonText}>Contact Support</Text>
          </TouchableOpacity>
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
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  faqItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
  },
  contactSection: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  contactButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
