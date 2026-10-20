import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import ScanScreen from '../screens/ScanScreen';
import ItemsScreen from '../screens/ItemsScreen';
import ShoppingListScreen from '../screens/ShoppingListScreen';
import PricesScreen from '../screens/PricesScreen';
import PhoneScreen from '../screens/PhoneScreen';
import OtpScreen from '../screens/OtpScreen';
import { useAuth } from '../context/AuthContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'JuiceList' }} />
      <Stack.Screen name="Scan" component={ScanScreen} options={{ title: 'Scan Receipt' }} />
      <Stack.Screen name="Items" component={ItemsScreen} options={{ title: 'Review Items' }} />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Phone" component={PhoneScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Otp" component={OtpScreen} options={{ title: 'Verify', headerBackTitle: 'Back' }} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: 'Home', headerShown: false }} />
      <Tab.Screen name="ShoppingList" component={ShoppingListScreen} options={{ title: 'Shopping List' }} />
      <Tab.Screen name="Prices" component={PricesScreen} options={{ title: 'Prices' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  return status === 'signedIn' ? <MainTabs /> : <AuthStack />;
}
