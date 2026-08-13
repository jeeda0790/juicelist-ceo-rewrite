import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import ScanScreen from '../screens/ScanScreen';
import ItemsScreen from '../screens/ItemsScreen';
import ShoppingListScreen from '../screens/ShoppingListScreen';
import PricesScreen from '../screens/PricesScreen';

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

export default function AppNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: 'Home', headerShown: false }} />
      <Tab.Screen name="ShoppingList" component={ShoppingListScreen} options={{ title: 'Shopping List' }} />
      <Tab.Screen name="Prices" component={PricesScreen} options={{ title: 'Prices' }} />
    </Tab.Navigator>
  );
}
