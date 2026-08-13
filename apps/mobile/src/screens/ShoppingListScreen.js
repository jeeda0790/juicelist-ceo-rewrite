import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, TouchableOpacity, RefreshControl } from 'react-native';
import { supabase } from '../config/supabase';

export default function ShoppingListScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('receipt_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setItems(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  const renderItem = ({ item }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemRow}>
        <Text style={styles.itemName}>{item.raw_name || item.raw_name_ar || 'Unknown item'}</Text>
        <Text style={styles.itemPrice}>{item.unit_price} JD</Text>
      </View>
      <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Shopping List</Text>
      {items.length === 0 && !loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No items yet</Text>
          <Text style={styles.emptySubtext}>Scan a receipt to get started!</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', padding: 16, color: '#222' },
  list: { paddingHorizontal: 16 },
  itemCard: {
    backgroundColor: '#f7f7f7',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemName: { fontSize: 15, fontWeight: '600', flex: 1, color: '#222' },
  itemPrice: { fontSize: 15, fontWeight: 'bold', color: '#2e7d32' },
  itemQty: { fontSize: 13, color: '#666', marginTop: 4 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#999' },
  emptySubtext: { fontSize: 14, color: '#bbb', marginTop: 8 },
});