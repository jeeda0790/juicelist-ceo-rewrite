import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>JuiceList</Text>
        <Text style={styles.subtitle}>Scan your receipt, find the best prices</Text>

        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => navigation.navigate('Scan')}
        >
          <Text style={styles.scanButtonText}>📷 Scan Receipt</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 48,
    textAlign: 'center',
  },
  scanButton: {
    backgroundColor: '#2e7d32',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});