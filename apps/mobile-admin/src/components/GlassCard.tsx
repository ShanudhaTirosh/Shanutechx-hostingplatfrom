import React from 'react';
import { View, ViewProps, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radius } from '@/theme/tokens';

interface GlassCardProps extends ViewProps {
  strong?: boolean;
  noPadding?: boolean;
  children?: React.ReactNode;
}


/**
 * Mirrors the mockup's `.glass` CSS class: translucent background,
 * subtle border, backdrop blur. React Native has no native backdrop-filter,
 * so this uses expo-blur (a real, hardware-accelerated blur on both iOS and
 * Android) layered under a translucent tint — the same visual result.
 */
export function GlassCard({ strong = false, noPadding = false, style, children, ...props }: GlassCardProps) {
  return (
    <View style={[styles.wrapper, style]} {...props}>
      {Platform.OS !== 'web' && (
        <BlurView intensity={strong ? 40 : 24} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      <View
        style={[
          styles.tint,
          { backgroundColor: strong ? colors.glassStrong : colors.glass },
          !noPadding && styles.padding,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  tint: {
    width: '100%',
  },
  padding: {
    padding: 18,
  },
});
