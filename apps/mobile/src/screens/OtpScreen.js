import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { apiRequest } from '../config/api';
import { useAuth } from '../context/AuthContext';

export default function OtpScreen({ route }) {
  const { phone, devCode: initialDevCode } = route.params;
  const { signIn } = useAuth();
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(initialDevCode);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const verify = async () => {
    if (code.length !== 6) {
      Alert.alert('Check the code', 'The code has 6 digits.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      // Saves the session on the phone and switches the app to the main screens.
      await signIn(data.token, data.user);
    } catch (error) {
      Alert.alert('Could not sign in', error.message || 'Could not connect to the server.');
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      const data = await apiRequest('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      setDevCode(data.devCode);
      setCode('');
      Alert.alert('Code sent', 'We sent you a new code.');
    } catch (error) {
      Alert.alert('Could not send code', error.message || 'Could not connect to the server.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>Enter your code</Text>
        <Text style={styles.subtitle}>We sent a 6-digit code to {phone}</Text>

        {devCode ? (
          // Only shown while the backend is in development mode (no SMS
          // provider yet). Disappears automatically once real SMS is connected.
          <TouchableOpacity style={styles.devBanner} onPress={() => setCode(devCode)}>
            <Text style={styles.devBannerText}>Dev mode, no SMS yet. Your code is {devCode}</Text>
            <Text style={styles.devBannerHint}>Tap to fill it in</Text>
          </TouchableOpacity>
        ) : null}

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={text => setCode(text.replace(/\D/g, '').slice(0, 6))}
          placeholder="------"
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          textContentType="oneTimeCode"
        />

        <TouchableOpacity style={styles.button} onPress={verify} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={resend} disabled={resending || loading}>
          <Text style={styles.linkText}>{resending ? 'Sending...' : 'Send a new code'}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2e7d32', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 24 },
  devBanner: {
    backgroundColor: '#fff8e1',
    borderWidth: 1,
    borderColor: '#f9a825',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  devBannerText: { color: '#6d4c00', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  devBannerHint: { color: '#6d4c00', fontSize: 13, textAlign: 'center', marginTop: 4 },
  input: {
    borderWidth: 2,
    borderColor: '#2e7d32',
    borderRadius: 12,
    fontSize: 28,
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 14,
    marginBottom: 20,
  },
  button: { backgroundColor: '#2e7d32', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  linkButton: { paddingVertical: 16, alignItems: 'center' },
  linkText: { color: '#1565c0', fontSize: 16 },
});
