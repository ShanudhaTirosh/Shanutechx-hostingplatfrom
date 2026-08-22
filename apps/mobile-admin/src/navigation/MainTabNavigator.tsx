import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { DeploymentsScreen } from '@/screens/DeploymentsScreen';
import { TicketsScreen } from '@/screens/TicketsScreen';
import { NodesScreen } from '@/screens/NodesScreen';
import { AnalyticsScreen } from '@/screens/AnalyticsScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { colors, fontFamily, spacing } from '@/theme/tokens';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, string> = {
  Dashboard: '🏠',
  Deployments: '🚀',
  Tickets: '🎫',
  Nodes: '🖥',
  Analytics: '📈',
  Profile: '👤',
};

function TabIcon({ label, focused }: { label: keyof MainTabParamList; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{ICONS[label]}</Text>
  );
}

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fontFamily.bodyMedium, fontSize: 9 },
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />,
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Deployments" component={DeploymentsScreen} />
      <Tab.Screen name="Tickets" component={TicketsScreen} />
      <Tab.Screen name="Nodes" component={NodesScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} options={{ title: 'Revenue' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    backgroundColor: 'rgba(20,18,24,0.7)',
    height: 82,
    paddingTop: 8,
    paddingBottom: 20,
  },
});
