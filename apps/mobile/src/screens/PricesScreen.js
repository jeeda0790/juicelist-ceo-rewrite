import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { apiRequest } from '../config/api';

export default function PricesScreen() {
  const [query, setQuery] = useState('');
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const searchPrices = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);

    try {
      const data = await apiRequest(`/api/receipts/prices/${encodeURIComponent(query)}`);
      if (data.success) {
        setPrices(data.prices);
      }
    } catch (error) {
      console.error(error);
      setPrices([]);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.priceCard}>
      <View style={styles.priceRow}>
        <Text style={styles.itemName}>{item.raw_name || item.raw_name_ar}</Text>
        <Text style={styles.itemPrice}>{item.unit_price} JD</Text>
      </View>
      <Text style={styles.storeLabel}>{item.store_name}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Compare Prices</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search for a product..."
          onSubmitEditing={searchPrices}
        />
        <TouchableOpacity style={styles.searchButton} onPress={searchPrices}>
          <Text style={styles.searchButtonText}>🔍</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator style={{ marginTop: 20 }} color="#2e7d32" />}

      {!loading && searched && prices.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No prices found</Text>
        </View>
      )}

      <FlatList
        data={prices}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', padding: 16, color: '#222' },
  searchRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: '#2e7d32',
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  searchButtonText: { fontSize: 18 },
  list: { paddingHorizontal: 16 },
  priceCard: {
    backgroundColor: '#f7f7f7',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemName: { fontSize: 15, fontWeight: '600', flex: 1, color: '#222' },
  itemPrice: { fontSize: 15, fontWeight: 'bold', color: '#2e7d32' },
  storeLabel: { fontSize: 13, color: '#666', marginTop: 4 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 16, color: '#999' },
});
