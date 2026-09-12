import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GoogleAuthProvider, GithubAuthProvider, OAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/Button';
import { GlassCard } from '@/components/GlassCard';
import { colors, fontFamily, radius } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

export function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { refreshApiUser } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github' | 'discord' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOAuthSignIn(providerType: 'google' | 'github' | 'discord') {
    setError(null);
    setLoadingProvider(providerType);
    try {
      let provider: GoogleAuthProvider | GithubAuthProvider | OAuthProvider;
      if (providerType === 'google') {
        provider = new GoogleAuthProvider();
      } else if (providerType === 'github') {
        provider = new GithubAuthProvider();
      } else {
        provider = new OAuthProvider('discord.com');
      }

      await signInWithPopup(auth, provider);
      await refreshApiUser();

      const { user } = await api.auth.me();
      if (user.role === 'customer') {
        setError('Staff access only. Customers please log in via the web dashboard.');
        return;
      }
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (err: any) {
      setError(err.message ?? 'OAuth sign-in failed. Please try again.');
    } finally {
      setLoadingProvider(null);
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
            <Text style={styles.title}>ShanuTechX Admin</Text>
            <Text style={styles.subtitle}>Google, GitHub & Discord OAuth SSO Standard</Text>
          </View>

          <GlassCard style={styles.card}>
            <View style={styles.ssoBadge}>
              <Text style={styles.ssoBadgeText}>OAUTH SSO ONLY</Text>
            </View>

            <Text style={styles.infoText}>
              Direct password logins are disabled. Please authenticate using your verified Google, GitHub, or Discord account.
            </Text>

            {error && <Text style={styles.error}>{error}</Text>}

            <Button
              label="Continue with Google"
              onPress={() => handleOAuthSignIn('google')}
              loading={loadingProvider === 'google'}
              style={{ marginTop: 16 }}
            />

            <Button
              label="Continue with GitHub"
              onPress={() => handleOAuthSignIn('github')}
              loading={loadingProvider === 'github'}
              style={{ marginTop: 12 }}
            />

            <Button
              label="Continue with Discord"
              onPress={() => handleOAuthSignIn('discord')}
              loading={loadingProvider === 'discord'}
              style={{ marginTop: 12 }}
            />
          </GlassCard>

          <Text style={styles.footer}>Staff access only — customers use the ShanuTechX web dashboard.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 28 },
  logo: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoText: { fontFamily: fontFamily.headExtrabold, fontSize: 30, color: '#1a0f33' },
  title: { fontFamily: fontFamily.head, fontSize: 22, color: colors.onSurface },
  subtitle: { fontFamily: fontFamily.body, fontSize: 13, color: colors.muted, marginTop: 6, textAlign: 'center' },
  card: { padding: 20 },
  ssoBadge: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 12,
  },
  ssoBadgeText: { color: colors.primary, fontFamily: fontFamily.bodySemibold, fontSize: 10, fontWeight: '700' },
  infoText: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 18 },
  error: { color: colors.error, fontFamily: fontFamily.bodyMedium, fontSize: 12, marginTop: 12, textAlign: 'center' },
  footer: { textAlign: 'center', color: colors.muted, fontFamily: fontFamily.body, fontSize: 11, marginTop: 24 },
});

