import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, Alert } from 'react-native';
import { apiRequest } from '../config/api';

export default function ItemsScreen({ route, navigation }) {
  const { receiptId, items: initialItems, store } = route.params;
  const [items, setItems] = useState(initialItems);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditName(item.raw_name || '');
    setEditPrice(String(item.unit_price));
  };

  const saveEdit = async () => {
    try {
      const data = await apiRequest(`/api/receipts/${receiptId}/items/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_name: editName,
          raw_name_ar: null,
          quantity: 1,
          unit_price: parseFloat(editPrice),
        }),
      });
      if (data.success) {
        setItems(currentItems => currentItems.map(i => i.id === editingId ? data.item : i));
        setEditingId(null);
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Could not save correction.');
    }
  };

  const finalizeReceipt = async () => {
    try {
      const data = await apiRequest(`/api/receipts/${receiptId}/finalize`, {
        method: 'POST',
      });
      if (data.success) {
        Alert.alert('Saved!', `${data.observations_saved} items saved to your shopping list.`, [
          { text: 'OK', onPress: () => navigation.navigate('Home') }
        ]);
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Could not finalize receipt.');
    }
  };

  const renderItem = ({ item }) => {
    const isEditing = editingId === item.id;

    if (isEditing) {
      return (
        <View style={styles.itemCard}>
          <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Item name" />
          <TextInput style={styles.input} value={editPrice} onChangeText={setEditPrice} placeholder="Price" keyboardType="decimal-pad" />
          <TouchableOpacity style={styles.saveButton} onPress={saveEdit}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <TouchableOpacity style={[styles.itemCard, item.needs_review && styles.itemCardReview]} onPress={() => startEdit(item)}>
        <View style={styles.itemRow}>
          <Text style={styles.itemName}>{item.raw_name || item.raw_name_ar || 'Unknown item'}</Text>
          <Text style={styles.itemPrice}>{item.unit_price} JD</Text>
        </View>
        {item.needs_review && <Text style={styles.reviewBadge}>⚠️ Tap to confirm</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.storeLabel}>Store: {store}</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
      <TouchableOpacity style={styles.finalizeButton} onPress={finalizeReceipt}>
        <Text style={styles.finalizeButtonText}>Confirm & Save All</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  storeLabel: { fontSize: 14, color: '#666', padding: 16, fontWeight: '600' },
  list: { paddingHorizontal: 16 },
  itemCard: {
    backgroundColor: '#f7f7f7',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  itemCardReview: { backgroundColor: '#fff3e0' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemName: { fontSize: 15, fontWeight: '600', flex: 1, color: '#222' },
  itemPrice: { fontSize: 15, fontWeight: 'bold', color: '#2e7d32' },
  reviewBadge: { fontSize: 12, color: '#e65100', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  saveButton: {
    backgroundColor: '#2e7d32',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: 'bold' },
  finalizeButton: {
    backgroundColor: '#1565c0',
    padding: 18,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  finalizeButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
