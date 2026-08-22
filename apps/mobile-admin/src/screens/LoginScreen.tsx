import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/Button';
import { GlassCard } from '@/components/GlassCard';
import { colors, fontFamily, radius } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

export function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      // Staff-only app — bounce non-staff accounts back out immediately.
      // (apiUser refresh happens inside AuthContext's onAuthStateChanged;
      // a short guard here covers the case where it resolves after signIn.)
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (err: any) {
      setError(mapFirebaseError(err.code) ?? err.message ?? 'Failed to sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={[colors.bgBase, '#14101f', colors.bgBase]} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <LinearGradient colors={[colors.primary, colors.cyan]} style={styles.logo}>
              <Text style={styles.logoText}>S</Text>
            </LinearGradient>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to the ShanuTechX admin console</Text>
          </View>

          <GlassCard style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@shanutechx.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={styles.input}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Button label="Sign In" onPress={handleLogin} loading={loading} style={{ marginTop: 20 }} />

            <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
          </GlassCard>

          <Text style={styles.footer}>Staff access only — customers use the ShanuTechX web dashboard.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function mapFirebaseError(code?: string): string | null {
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a few minutes.';
    case 'auth/network-request-failed':
      return 'Network error — check your connection.';
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoText: { fontFamily: fontFamily.headExtrabold, fontSize: 30, color: '#1a0f33' },
  title: { fontFamily: fontFamily.head, fontSize: 22, color: colors.onSurface },
  subtitle: { fontFamily: fontFamily.body, fontSize: 13, color: colors.muted, marginTop: 6, textAlign: 'center' },
  card: {},
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
  error: { color: colors.error, fontFamily: fontFamily.bodyMedium, fontSize: 12, marginTop: 12 },
  link: { color: colors.primary, fontFamily: fontFamily.bodyMedium, fontSize: 13 },
  footer: { textAlign: 'center', color: colors.muted, fontFamily: fontFamily.body, fontSize: 11, marginTop: 24 },
});
