import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@/lib/AuthContext';
import { colors, fontFamily } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

export function SplashScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { firebaseUser, apiUser, loading } = useAuth();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }),
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      // apiUser may still be fetching when loading=false; only check firebaseUser
      // here. The MainTabNavigator screens each handle the case where apiUser is null.
      if (firebaseUser) {
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [loading, firebaseUser]);

  return (
    <LinearGradient colors={[colors.bgBase, '#14101f', colors.bgBase]} style={styles.container}>
      <Animated.View style={{ transform: [{ scale }], opacity, alignItems: 'center' }}>
        <LinearGradient colors={[colors.primary, colors.cyan]} style={styles.logo}>
          <Text style={styles.logoText}>S</Text>
        </LinearGradient>
        <Text style={styles.title}>ShanuTechX</Text>
        <Text style={styles.subtitle}>Admin Console</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontFamily: fontFamily.headExtrabold,
    fontSize: 40,
    color: '#1a0f33',
  },
  title: {
    fontFamily: fontFamily.headExtrabold,
    fontSize: 26,
    color: colors.onSurface,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
