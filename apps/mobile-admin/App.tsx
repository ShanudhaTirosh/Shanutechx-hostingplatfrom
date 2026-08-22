import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import * as SplashScreenNative from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts as usePlusJakartaSans,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  useFonts as useInter,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { AuthProvider } from '@/lib/AuthContext';
import { RootNavigator } from '@/navigation/RootNavigator';
import { colors } from '@/theme/tokens';

SplashScreenNative.preventAutoHideAsync().catch(() => {});

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bgBase,
    card: colors.bgScreen,
    border: colors.glassBorder,
    primary: colors.primary,
    text: colors.onSurface,
  },
};

export default function App() {
  const [jakartaLoaded] = usePlusJakartaSans({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const [interLoaded] = useInter({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  const fontsLoaded = jakartaLoaded && interLoaded;

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreenNative.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={{ flex: 1, backgroundColor: colors.bgBase }} onLayout={onLayoutRootView}>
          <StatusBar style="light" />
          <NavigationContainer theme={navTheme}>
            <RootNavigator />
          </NavigationContainer>
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
