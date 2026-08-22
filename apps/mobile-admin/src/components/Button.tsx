import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, fontFamily } from '@/theme/tokens';

type Variant = 'primary' | 'glass' | 'outline' | 'success' | 'danger' | 'outlineDanger';
type Size = 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

const GRADIENTS: Record<string, [string, string]> = {
  primary: [colors.primary, colors.primaryDark],
  success: ['#4ADE80', '#16A34A'],
  danger: [colors.error, colors.errorStrong],
};

export function Button({ label, onPress, variant = 'primary', size = 'md', loading, disabled, style, icon }: ButtonProps) {
  const height = size === 'sm' ? 40 : 52;
  const fontSize = size === 'sm' ? 13 : 15;
  const isGradient = variant === 'primary' || variant === 'success' || variant === 'danger';

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#1a0f33' : '#fff'} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.label,
              { fontSize },
              variant === 'primary' && { color: '#1a0f33' },
              variant === 'success' && { color: '#052e12' },
              variant === 'danger' && { color: '#3a0805' },
              variant === 'glass' && { color: colors.onSurface },
              variant === 'outline' && { color: colors.primary },
              variant === 'outlineDanger' && { color: '#ff8a80' },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </>
  );

  if (isGradient) {
    return (
      <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [{ opacity: pressed ? 0.85 : disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }, style]}>
        <LinearGradient
          colors={GRADIENTS[variant]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, { height, borderRadius: size === 'sm' ? radius.sm : radius.md }]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { height, borderRadius: size === 'sm' ? radius.sm : radius.md, opacity: pressed ? 0.85 : disabled ? 0.5 : 1 },
        variant === 'glass' && { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
        variant === 'outline' && { backgroundColor: 'rgba(207,188,255,0.08)', borderWidth: 1, borderColor: 'rgba(207,188,255,0.35)' },
        variant === 'outlineDanger' && { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)' },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  label: {
    fontFamily: fontFamily.head,
    fontWeight: '700',
  },
});
