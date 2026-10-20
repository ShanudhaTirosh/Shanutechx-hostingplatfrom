import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/Button';
import { GlassCard } from '@/components/GlassCard';
import { GoogleIcon, GithubIcon } from '@/components/SocialIcons';
import { colors, fontFamily, radius, spacing } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

type LoginTab = 'oauth' | 'key';

const PRESET_URLS = [
  { label: 'Production Cloud', url: 'https://api.shanutechx.com' },
  { label: 'Local Dev (localhost:4000)', url: 'http://localhost:4000' },
  { label: 'Android Emulator (10.0.2.2:4000)', url: 'http://10.0.2.2:4000' },
];

function friendlyError(err: any): string {
  const msg = err?.message || String(err);
  if (msg.includes('popup-closed-by-user')) {
    return 'Sign-in window was closed before completing.';
  }
  if (msg.includes('cancelled-popup-request')) {
    return 'Sign-in request was cancelled.';
  }
  if (msg.includes('popup-blocked')) {
    return 'Popup was blocked by your browser or device. Please allow popups.';
  }
  if (msg.includes('account-exists-with-different-credential')) {
    return 'An account already exists with this email via a different provider.';
  }
  if (msg.includes('unauthorized-domain')) {
    return 'This domain is not authorized for OAuth in Firebase configuration.';
  }
  return msg || 'Authentication failed. Please try again.';
}

export function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { signInWithGoogle, signInWithGithub, signInWithApiKey, serverUrl, setServerUrl } = useAuth();

  const [tab, setTab] = useState<LoginTab>('oauth');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [busyProvider, setBusyProvider] = useState<'google' | 'github' | 'key' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Server switch modal
  const [serverModalVisible, setServerModalVisible] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(serverUrl);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  async function handleGoogleLogin() {
    setError(null);
    setBusyProvider('google');
    try {
      await signInWithGoogle();
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (err: any) {
      setError(friendlyError(err));
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleGithubLogin() {
    setError(null);
    setBusyProvider('github');
    try {
      await signInWithGithub();
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (err: any) {
      setError(friendlyError(err));
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleKeyLogin() {
    if (!apiKey.trim()) {
      setError('Please enter your Staff / Dev API key (starts with shx_)');
      return;
    }
    setError(null);
    setBusyProvider('key');
    try {
      await signInWithApiKey(apiKey.trim());
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify your API key.');
    } finally {
      setBusyProvider(null);
    }
  }

  async function testCurrentConnection(targetUrl?: string) {
    const url = (targetUrl || customServerUrl).trim().replace(/\/+$/, '');
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) {
        setConnectionStatus('Connected successfully! (HTTP 200)');
      } else {
        setConnectionStatus(`Connected with warning: HTTP ${res.status}`);
      }
    } catch (err: any) {
      setConnectionStatus(`Connection failed: ${err.message || 'Network error'}`);
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleSaveServerUrl(url: string) {
    const clean = url.trim().replace(/\/+$/, '');
    if (!clean) return;
    try {
      await setServerUrl(clean);
    } catch (e: any) {
      // e.g. plain http:// or a URL with embedded credentials: the credentials would be sent there.
      Alert.alert('Invalid server URL', e?.message ?? 'Could not save the server URL.');
      return;
    }
    setCustomServerUrl(clean);
    setServerModalVisible(false);
    setError(null);
  }

  const isBusy = busyProvider !== null;

  return (
    <LinearGradient colors={[colors.bgBase, '#130d24', colors.bgBase]} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <LinearGradient colors={[colors.primary, colors.cyan]} style={styles.logo}>
              <Text style={styles.logoText}>S</Text>
            </LinearGradient>
            <Text style={styles.title}>ShanuTechX Admin</Text>
            <Text style={styles.subtitle}>Autonomous Enterprise Cloud Console</Text>
          </View>

          {/* Main Card */}
          <GlassCard style={styles.card}>
            {/* Tabs */}
            <View style={styles.tabBar}>
              <Pressable
                onPress={() => { setTab('oauth'); setError(null); }}
                style={[styles.tab, tab === 'oauth' && styles.tabActive]}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={14}
                  color={tab === 'oauth' ? colors.primary : colors.muted}
                />
                <Text style={[styles.tabText, tab === 'oauth' && styles.tabTextActive]}>
                  OAuth SSO
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { setTab('key'); setError(null); }}
                style={[styles.tab, tab === 'key' && styles.tabActive]}
              >
                <Ionicons
                  name="key-outline"
                  size={14}
                  color={tab === 'key' ? colors.primary : colors.muted}
                />
                <Text style={[styles.tabText, tab === 'key' && styles.tabTextActive]}>
                  Staff API Key
                </Text>
              </Pressable>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.error} style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {tab === 'oauth' ? (
              <View>
                {/* Security Badge */}
                <View style={styles.securityBadge}>
                  <Ionicons name="shield-checkmark" size={13} color={colors.success} />
                  <Text style={styles.securityBadgeText}>Single Sign-On Security Standard</Text>
                </View>

                <Text style={styles.infoText}>
                  Platform security enforces Single Sign-On exclusively via Google and GitHub OAuth. Direct password input forms are disabled across all client apps.
                </Text>

                {/* OAuth Provider Buttons */}
                <View style={{ gap: 12, marginTop: 4 }}>
                  {/* Google Login Button */}
                  <Pressable
                    onPress={handleGoogleLogin}
                    disabled={isBusy}
                    style={({ pressed }) => [
                      styles.oauthButton,
                      styles.googleButton,
                      { opacity: pressed || isBusy ? 0.8 : 1 },
                    ]}
                  >
                    {busyProvider === 'google' ? (
                      <ActivityIndicator size="small" color="#1a0f33" />
                    ) : (
                      <GoogleIcon size={20} />
                    )}
                    <Text style={styles.googleButtonText}>
                      {busyProvider === 'google' ? 'Signing in with Google…' : 'Continue with Google'}
                    </Text>
                  </Pressable>

                  {/* GitHub Login Button */}
                  <Pressable
                    onPress={handleGithubLogin}
                    disabled={isBusy}
                    style={({ pressed }) => [
                      styles.oauthButton,
                      styles.githubButton,
                      { opacity: pressed || isBusy ? 0.8 : 1 },
                    ]}
                  >
                    {busyProvider === 'github' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <GithubIcon size={20} color="#FFFFFF" />
                    )}
                    <Text style={styles.githubButtonText}>
                      {busyProvider === 'github' ? 'Signing in with GitHub…' : 'Continue with GitHub'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.oauthFooterBadge}>
                  <Ionicons name="lock-closed-outline" size={12} color={colors.muted} />
                  <Text style={styles.oauthFooterText}>
                    Zero password storage · Auto-provisioned federated roles
                  </Text>
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.infoText}>
                  Enter your ShanuTechX Staff / Dev API Key. Grants instant superuser access to container orchestration, nodes, and live systems.
                </Text>

                <Text style={styles.label}>Developer API Key</Text>
                <View style={styles.apiKeyWrapper}>
                  <TextInput
                    value={apiKey}
                    onChangeText={setApiKey}
                    placeholder="shx_live_..."
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!showApiKey}
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  />
                  <Pressable
                    onPress={() => setShowApiKey(!showApiKey)}
                    style={styles.eyeBtn}
                  >
                    <Ionicons
                      name={showApiKey ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={colors.muted}
                    />
                  </Pressable>
                </View>

                <Button
                  label="Sign In with API Key"
                  icon={<Ionicons name="key-outline" size={15} color="#1a0f33" />}
                  onPress={handleKeyLogin}
                  loading={busyProvider === 'key'}
                  disabled={isBusy}
                  style={{ marginTop: 18 }}
                />
              </View>
            )}
          </GlassCard>

          {/* Server Endpoint Bar */}
          <Pressable
            onPress={() => {
              setCustomServerUrl(serverUrl);
              setConnectionStatus(null);
              setServerModalVisible(true);
            }}
            style={styles.serverBar}
          >
            <View style={styles.serverDot} />
            <Text style={styles.serverText} numberOfLines={1}>
              API: <Text style={{ color: colors.onSurface }}>{serverUrl.replace(/^https?:\/\//, '')}</Text>
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.serverChangeText}>Switch</Text>
              <Ionicons name="settings-outline" size={12} color={colors.primary} />
            </View>
          </Pressable>

          <Text style={styles.footer}>
            ShanuTechX Admin Console · Staff & Superuser Portal v2.0
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Server Endpoint Switcher Modal */}
      <Modal
        visible={serverModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setServerModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>API Server Endpoint</Text>
              <Pressable onPress={() => setServerModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.onSurface} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Select target environment or enter custom backend URL:
            </Text>

            {/* Presets */}
            <View style={{ gap: 8, marginVertical: 12 }}>
              {PRESET_URLS.map((preset) => {
                const isSelected = customServerUrl === preset.url;
                return (
                  <Pressable
                    key={preset.url}
                    onPress={() => setCustomServerUrl(preset.url)}
                    style={[styles.presetRow, isSelected && styles.presetRowSelected]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.presetLabel, isSelected && { color: colors.primary }]}>
                        {preset.label}
                      </Text>
                      <Text style={styles.presetUrl}>{preset.url}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Custom Server URL</Text>
            <TextInput
              value={customServerUrl}
              onChangeText={setCustomServerUrl}
              placeholder="https://api.shanutechx.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={styles.input}
            />

            {connectionStatus && (
              <Text
                style={[
                  styles.statusMessage,
                  { color: connectionStatus.includes('successfully') ? colors.success : colors.warning },
                ]}
              >
                {connectionStatus}
              </Text>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button
                label={testingConnection ? 'Testing…' : 'Test Ping'}
                icon={<Ionicons name="flash-outline" size={14} color={colors.onSurface} />}
                variant="glass"
                size="sm"
                onPress={() => testCurrentConnection()}
                disabled={testingConnection}
                style={{ flex: 1 }}
              />
              <Button
                label="Save & Connect"
                icon={<Ionicons name="checkmark" size={14} color="#1a0f33" />}
                variant="primary"
                size="sm"
                onPress={() => handleSaveServerUrl(customServerUrl)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoText: { fontFamily: fontFamily.headExtrabold, fontSize: 32, color: '#1a0f33' },
  title: { fontFamily: fontFamily.head, fontSize: 24, color: colors.onSurface },
  subtitle: { fontFamily: fontFamily.body, fontSize: 13, color: colors.muted, marginTop: 4, textAlign: 'center' },
  card: { padding: 20 },
  tabBar: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(207,188,255,0.15)',
    borderColor: colors.primary,
  },
  tabText: { fontFamily: fontFamily.bodyMedium, fontSize: 13, color: colors.muted },
  tabTextActive: { color: colors.primary, fontFamily: fontFamily.bodySemibold },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)',
    marginBottom: 10,
  },
  securityBadgeText: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: 11,
    color: colors.success,
    letterSpacing: 0.3,
  },
  infoText: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 14 },
  oauthButton: {
    height: 50,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  googleButtonText: {
    fontFamily: fontFamily.head,
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  githubButton: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  githubButtonText: {
    fontFamily: fontFamily.head,
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  oauthFooterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  oauthFooterText: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: colors.muted,
  },
  label: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.muted, marginBottom: 6 },
  apiKeyWrapper: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  eyeBtn: { position: 'absolute', right: 14, padding: 6 },
  input: {
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    color: colors.onSurface,
    fontFamily: fontFamily.body,
    fontSize: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    marginBottom: 14,
  },
  errorText: { color: colors.error, fontFamily: fontFamily.bodyMedium, fontSize: 12, flex: 1 },
  serverBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  serverDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  serverText: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted },
  serverChangeText: { fontFamily: fontFamily.bodySemibold, fontSize: 11, color: colors.primary, marginLeft: 6 },
  footer: { textAlign: 'center', color: colors.muted, fontFamily: fontFamily.body, fontSize: 11, marginTop: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.bgScreen2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { fontFamily: fontFamily.headSemibold, fontSize: 16, color: colors.onSurface },
  modalSubtitle: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginBottom: 8 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center' },
  presetRow: { padding: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: 'rgba(255,255,255,0.03)', flexDirection: 'row', alignItems: 'center' },
  presetRowSelected: { borderColor: colors.primary, backgroundColor: 'rgba(207,188,255,0.1)' },
  presetLabel: { fontFamily: fontFamily.bodySemibold, fontSize: 12, color: colors.onSurface },
  presetUrl: { fontFamily: 'monospace', fontSize: 11, color: colors.muted, marginTop: 2 },
  statusMessage: { fontFamily: fontFamily.bodyMedium, fontSize: 11, marginTop: 8, textAlign: 'center' },
});
