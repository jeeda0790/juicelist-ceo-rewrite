import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { apiRequest } from '../config/api';

const COUNTRY_CODE = '+962';

// Jordanian mobile numbers are 9 digits starting with 7 (e.g. 79 123 4567).
// People often type a leading 0 (079...), so we drop it. Everyone is stored
// as +962XXXXXXXXX, so the same person never ends up as two accounts.
export function toFullPhone(input) {
  const digits = String(input || '').replace(/\D/g, '').replace(/^0+/, '');
  return `${COUNTRY_CODE}${digits}`;
}

export function isValidJordanMobile(input) {
  const digits = String(input || '').replace(/\D/g, '').replace(/^0+/, '');
  return /^7\d{8}$/.test(digits);
}

export default function PhoneScreen({ navigation }) {
  const [phoneInput, setPhoneInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    if (!isValidJordanMobile(phoneInput)) {
      Alert.alert('Check your number', 'Enter a Jordanian mobile number, like 79 123 4567.');
      return;
    }

    setLoading(true);
    try {
      const phone = toFullPhone(phoneInput);
      const data = await apiRequest('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      navigation.navigate('Otp', { phone: data.phone || phone, devCode: data.devCode });
    } catch (error) {
      Alert.alert('Could not send code', error.message || 'Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>JuiceList</Text>
        <Text style={styles.subtitle}>Enter your phone number to sign in</Text>

        <View style={styles.inputRow}>
          <Text style={styles.prefix}>{COUNTRY_CODE}</Text>
          <TextInput
            style={styles.input}
            value={phoneInput}
            onChangeText={setPhoneInput}
            placeholder="79 123 4567"
            keyboardType="phone-pad"
            maxLength={12}
            autoFocus
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={sendCode} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send code</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 36, fontWeight: 'bold', color: '#2e7d32', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 40 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2e7d32',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  prefix: { fontSize: 20, color: '#333', marginRight: 10, fontWeight: '600' },
  input: { flex: 1, fontSize: 20, paddingVertical: 14 },
  button: { backgroundColor: '#2e7d32', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
