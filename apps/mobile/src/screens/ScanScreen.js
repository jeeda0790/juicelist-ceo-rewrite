import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiRequest } from '../config/api';

export default function ScanScreen({ navigation }) {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async (useCamera) => {
    const permissionResult = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission needed', 'We need access to continue.');
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const uploadReceipt = async () => {
    if (!image) {
      Alert.alert('No image', 'Please take or select a photo first.');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('image', {
        uri: image,
        type: 'image/jpeg',
        name: 'receipt.jpg',
      });

      const data = await apiRequest('/api/receipts/scan', {
        method: 'POST',
        body: formData,
      });

      if (data.success) {
        navigation.navigate('Items', { receiptId: data.receipt_id, items: data.items, store: data.store });
      } else {
        Alert.alert('Scan failed', data.error || 'Something went wrong');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Could not connect to the server.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {image ? (
          <Image source={{ uri: image }} style={styles.preview} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No photo yet</Text>
          </View>
        )}

        <TouchableOpacity style={styles.button} onPress={() => pickImage(true)}>
          <Text style={styles.buttonText}>📷 Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.buttonSecondary} onPress={() => pickImage(false)}>
          <Text style={styles.buttonSecondaryText}>🖼️ Choose from Gallery</Text>
        </TouchableOpacity>

        {image && (
          <TouchableOpacity style={styles.uploadButton} onPress={uploadReceipt} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.uploadButtonText}>Scan Receipt</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 20, justifyContent: 'center' },
  placeholder: {
    height: 300,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  placeholderText: { color: '#999', fontSize: 16 },
  preview: { height: 300, borderRadius: 12, marginBottom: 24, resizeMode: 'contain' },
  button: {
    backgroundColor: '#2e7d32',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#2e7d32',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonSecondaryText: { color: '#2e7d32', fontSize: 16, fontWeight: 'bold' },
  uploadButton: {
    backgroundColor: '#1565c0',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  uploadButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
