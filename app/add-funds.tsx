import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLedger } from '@/context/LedgerContext';
import { useAuth } from '@/hooks/useAuth';
import { walletApi } from '@/api/wallet';
import { transactionsApi } from '@/api/transactions';

export default function AddFundsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { addFunds } = useLedger();
  const { user } = useAuth();
  
  const [amount, setAmount] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Theme colors
  const backgroundColor = Colors[colorScheme ?? 'light'].background;
  const textColor = Colors[colorScheme ?? 'light'].text;
  const tintColor = Colors[colorScheme ?? 'light'].tint;
  const inputBackground = colorScheme === 'dark' ? '#2a2a2a' : '#f0f0f0';

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
    return formatted.slice(0, 19);
  };

  const formatExpiryDate = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    setAmount(cleaned);
  };

  const handleCardNumberChange = (text: string) => {
    setCardNumber(formatCardNumber(text));
  };

  const handleExpiryChange = (text: string) => {
    setExpiryDate(formatExpiryDate(text));
  };

  const handleCvvChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    setCvv(cleaned.slice(0, 4));
  };

  const validateForm = () => {
    const amountValue = parseFloat(amount);
    if (!amount || isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to add.');
      return false;
    }
    if (cardNumber.replace(/\s/g, '').length !== 16) {
      Alert.alert('Invalid Card', 'Please enter a valid 16-digit card number.');
      return false;
    }
    if (expiryDate.length !== 5) {
      Alert.alert('Invalid Expiry', 'Please enter a valid expiry date (MM/YY).');
      return false;
    }
    if (cvv.length < 3 || cvv.length > 4) {
      Alert.alert('Invalid CVV', 'Please enter a valid CVV (3-4 digits).');
      return false;
    }
    if (!cardholderName.trim()) {
      Alert.alert('Invalid Name', 'Please enter the cardholder name.');
      return false;
    }
    return true;
  };

const handleAddFunds = async () => {
    if (!validateForm()) return;

    if (!user) {
      Alert.alert('Error', 'You must be logged in to add funds.');
      return;
    }

    setIsLoading(true);
    
    try {
      const amountValue = parseFloat(amount);
      
      // Add funds to the user's wallet in the database
      await walletApi.addFunds(user.id, amountValue);
      
      // Create a transaction record
      await transactionsApi.create({
        user_id: user.id,
        title: 'Wallet Deposit',
        amount: amountValue,
        type: 'income',
        category: 'Deposit',
        date: new Date().toISOString().split('T')[0],
      });
      
      // Update local ledger state for UI reactivity
      addFunds(amountValue);
      
      setIsLoading(false);
      Alert.alert(
        'Success',
        `$${amountValue.toFixed(2)} has been added to your wallet!`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Error adding funds:', error);
      setIsLoading(false);
      Alert.alert(
        'Error',
        'Failed to add funds. Please try again.',
        [
          {
            text: 'OK',
          },
        ]
      );
    }
  };

  return (
    <View style={{ ...styles.container, paddingTop: insets.top, backgroundColor }}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={backgroundColor} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={{...styles.header, backgroundColor}}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={{...styles.backButtonText, color: tintColor}}>Back</Text>
          </TouchableOpacity>
          <Text style={{...styles.title, color: textColor}}>Add Funds</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
          {/* Amount Input */}
          <View style={styles.section}>
            <Text style={{...styles.sectionTitle, color: textColor}}>Amount</Text>
            <View style={[styles.amountInputContainer, { backgroundColor: inputBackground }]}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={[styles.amountInput, { color: textColor }]}
                placeholder="0.00"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={handleAmountChange}
              />
            </View>
          </View>

          {/* Card Details */}
          <View style={styles.section}>
            <Text style={{...styles.sectionTitle, color: textColor}}>Card Details</Text>
            
            <View style={[styles.inputContainer, { backgroundColor: inputBackground }]}>
              <Text style={styles.inputLabel}>Cardholder Name</Text>
              <TextInput
                style={[styles.input, { color: textColor }]}
                placeholder="John Doe"
                placeholderTextColor="#999"
                value={cardholderName}
                onChangeText={setCardholderName}
                autoCapitalize="words"
              />
            </View>

            <View style={[styles.inputContainer, { backgroundColor: inputBackground }]}>
              <Text style={styles.inputLabel}>Card Number</Text>
              <TextInput
                style={[styles.input, { color: textColor }]}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor="#999"
                keyboardType="numeric"
                value={cardNumber}
                onChangeText={handleCardNumberChange}
                maxLength={19}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputContainer, { backgroundColor: inputBackground, flex: 1, marginRight: 10 }]}>
                <Text style={styles.inputLabel}>Expiry Date</Text>
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="MM/YY"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={expiryDate}
                  onChangeText={handleExpiryChange}
                  maxLength={5}
                />
              </View>
              <View style={[styles.inputContainer, { backgroundColor: inputBackground, flex: 1 }]}>
                <Text style={styles.inputLabel}>CVV</Text>
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="123"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={cvv}
                  onChangeText={handleCvvChange}
                  maxLength={4}
                  secureTextEntry
                />
              </View>
            </View>
          </View>

          {/* Security Note */}
          <View style={styles.securityNote}>
            <Text style={styles.securityIcon}>🔒</Text>
            <Text style={{...styles.securityText, color: textColor}}>
              Your card information is secure and encrypted
            </Text>
          </View>

          {/* Add Funds Button */}
          <TouchableOpacity 
            style={[styles.addButton, { backgroundColor: tintColor }]}
            onPress={handleAddFunds}
            disabled={isLoading}
          >
            <Text style={styles.addButtonText}>
              {isLoading ? 'Processing...' : `Add $${amount || '0.00'}`}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4a90e2',
    marginRight: 10,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: 'bold',
    padding: 0,
  },
  inputContainer: {
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
  },
  input: {
    fontSize: 16,
    padding: 0,
  },
  row: {
    flexDirection: 'row',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  securityIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  securityText: {
    fontSize: 12,
    color: '#666',
  },
  addButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 30,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
