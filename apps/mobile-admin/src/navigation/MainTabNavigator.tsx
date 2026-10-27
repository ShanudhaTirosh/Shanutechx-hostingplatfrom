import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { DeploymentsScreen } from '@/screens/DeploymentsScreen';
import { TicketsScreen } from '@/screens/TicketsScreen';
import { NodesScreen } from '@/screens/NodesScreen';
import { AnalyticsScreen } from '@/screens/AnalyticsScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '@/theme/tokens';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Dashboard: { active: 'grid', inactive: 'grid-outline' },
  Deployments: { active: 'rocket', inactive: 'rocket-outline' },
  Tickets: { active: 'ticket', inactive: 'ticket-outline' },
  Nodes: { active: 'server', inactive: 'server-outline' },
  Analytics: { active: 'stats-chart', inactive: 'stats-chart-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

function TabIcon({ label, focused }: { label: keyof MainTabParamList; focused: boolean }) {
  const icon = ICONS[label];
  return (
    <View style={focused ? styles.iconActiveWrapper : null}>
      <Ionicons
        name={focused ? icon.active : icon.inactive}
        size={20}
        color={focused ? colors.primary : colors.muted}
      />
    </View>
  );
}

export function MainTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fontFamily.bodyMedium, fontSize: 9 },
        tabBarStyle: [
          styles.tabBar,
          {
            height: 58 + Math.max(insets.bottom, 12),
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ],
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
    backgroundColor: 'rgba(20,18,24,0.85)',
    paddingTop: 8,
  },
  iconActiveWrapper: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(207,188,255,0.12)',
  },
});
