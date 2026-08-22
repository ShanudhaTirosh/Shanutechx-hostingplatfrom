import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/Button';
import { GlassCard } from '@/components/GlassCard';
import { colors, fontFamily, radius } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

export function ForgotPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setError(null);
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (err: any) {
      // Deliberately vague — don't confirm/deny whether an account exists
      // for this email, matching standard password-reset security practice.
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={[colors.bgBase, '#14101f', colors.bgBase]} style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <GlassCard>
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.subtitle}>
          {sent
            ? "If an account exists for that email, we've sent a reset link. Check your inbox."
            : "Enter your email and we'll send you a link to reset your password."}
        </Text>

        {!sent && (
          <>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@shanutechx.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Button label="Send Reset Link" onPress={handleSend} loading={loading} style={{ marginTop: 18 }} />
          </>
        )}

        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 18, alignItems: 'center' }}>
          <Text style={styles.link}>Back to Sign In</Text>
        </Pressable>
      </GlassCard>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fontFamily.head, fontSize: 20, color: colors.onSurface, marginBottom: 8 },
  subtitle: { fontFamily: fontFamily.body, fontSize: 13, color: colors.muted, marginBottom: 20, lineHeight: 19 },
  label: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.muted, marginBottom: 6 },
  input: {
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    color: colors.onSurface,
    fontFamily: fontFamily.body,
    fontSize: 15,
  },
  error: { color: colors.error, fontFamily: fontFamily.bodyMedium, fontSize: 12, marginTop: 10 },
  link: { color: colors.primary, fontFamily: fontFamily.bodyMedium, fontSize: 13 },
});
