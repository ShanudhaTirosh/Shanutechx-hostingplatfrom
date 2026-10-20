import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { colors, fontFamily, radius, spacing } from '@/theme/tokens';

const PRESET_ENDPOINTS = [
  { label: 'Production Cloud', url: 'https://api.shanutechx.com' },
  { label: 'Local Development', url: 'http://localhost:4000' },
  { label: 'Android Emulator', url: 'http://10.0.2.2:4000' },
];

export function ProfileScreen() {
  const { apiUser, serverUrl, setServerUrl, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const [modalVisible, setModalVisible] = useState(false);
  const [customUrl, setCustomUrl] = useState(serverUrl);
  const [pingResult, setPingResult] = useState<{ type: 'success' | 'warn' | 'error'; text: string } | null>(null);
  const [pinging, setPinging] = useState(false);

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to log out of the admin session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  async function handleTestConnection(urlToTest?: string) {
    const target = (urlToTest || customUrl).trim().replace(/\/+$/, '');
    if (!target) return;
    setPinging(true);
    setPingResult(null);
    const start = Date.now();
    try {
      const res = await fetch(`${target}/api/health`);
      const latency = Date.now() - start;
      if (res.ok) {
        setPingResult({ type: 'success', text: `Connected (${latency}ms)` });
      } else {
        setPingResult({ type: 'warn', text: `Server responded ${res.status}` });
      }
    } catch (err: any) {
      setPingResult({ type: 'error', text: `Unreachable: ${err.message || 'Network error'}` });
    } finally {
      setPinging(false);
    }
  }

  async function handleSaveEndpoint() {
    const clean = customUrl.trim().replace(/\/+$/, '');
    if (!clean) {
      Alert.alert('Invalid URL', 'Please enter a valid API URL');
      return;
    }
    try {
      await setServerUrl(clean);
    } catch (e: any) {
      Alert.alert('Invalid server URL', e?.message ?? 'Could not save the server URL.');
      return;
    }
    setModalVisible(false);
    Alert.alert('Server Updated', `Active API endpoint set to:\n${clean}`);
  }

  const isSuperuser = apiUser?.role === 'dev' || apiUser?.role === 'admin';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: 110 }}
    >
      <Text style={styles.title}>Staff Account</Text>

      {/* Profile Card */}
      <GlassCard style={{ alignItems: 'center', marginBottom: 16, padding: 20 }}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(apiUser?.email ?? 'A')[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{apiUser?.displayName || apiUser?.email || 'Administrator'}</Text>
        <Text style={styles.email}>{apiUser?.email}</Text>

        <View style={[styles.roleBadge, isSuperuser && { backgroundColor: 'rgba(99,102,241,0.2)' }]}>
          <Ionicons
            name={apiUser?.role === 'dev' ? 'flash' : 'shield-checkmark'}
            size={11}
            color={colors.primary}
            style={{ marginRight: 4 }}
          />
          <Text style={styles.roleText}>
            {apiUser?.role === 'dev' ? 'DEV SUPERUSER' : `${apiUser?.role?.toUpperCase() || 'ADMIN'} OPERATOR`}
          </Text>
        </View>
      </GlassCard>

      {/* Connection & System Specs */}
      <GlassCard style={{ marginBottom: 16, padding: 14 }}>
        <Text style={styles.sectionTitle}>Environment & Gateway</Text>
        <Row label="Staff Role" value={apiUser?.role || 'admin'} highlight />
        <Row label="Account ID" value={apiUser?.id || '—'} mono />
        <Pressable
          onPress={() => {
            setCustomUrl(serverUrl);
            setPingResult(null);
            setModalVisible(true);
          }}
        >
          <Row
            label="API Gateway"
            value={serverUrl.replace(/^https?:\/\//, '')}
            rightIcon={<Ionicons name="create-outline" size={14} color={colors.primary} />}
            mono
            highlight
          />
        </Pressable>
        <Row label="Client Version" value="2.0.0 (Expo 51)" mono />
        <Row label="Protocol" value="REST & OpenTelemetry" last />
      </GlassCard>

      {/* Quick Action: Change Server Gateway */}
      <View style={{ marginBottom: 16 }}>
        <Button
          label="Change API Server Gateway"
          icon={<Ionicons name="globe-outline" size={16} color={colors.onSurface} />}
          variant="glass"
          onPress={() => {
            setCustomUrl(serverUrl);
            setPingResult(null);
            setModalVisible(true);
          }}
        />
      </View>

      {/* Sign Out Button */}
      <Button
        label="Sign Out"
        icon={<Ionicons name="log-out-outline" size={16} color="#ff8a80" />}
        variant="outlineDanger"
        onPress={handleSignOut}
      />

      <Text style={styles.footer}>ShanuTechX Autonomous Cloud · Enterprise Admin v2.0</Text>

      {/* Endpoint Switcher Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Configure API Gateway</Text>
            <Text style={styles.modalSubtitle}>
              Select a cluster preset or type a custom host URL:
            </Text>

            {/* Presets */}
            <View style={{ gap: 8, marginBottom: 14 }}>
              {PRESET_ENDPOINTS.map((p) => {
                const isSelected = customUrl === p.url;
                return (
                  <Pressable
                    key={p.url}
                    style={[styles.presetRow, isSelected && styles.presetRowActive]}
                    onPress={() => {
                      setCustomUrl(p.url);
                      handleTestConnection(p.url);
                    }}
                  >
                    <Text style={[styles.presetLabel, isSelected && { color: colors.primary }]}>{p.label}</Text>
                    <Text style={styles.presetUrl}>{p.url}</Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={customUrl}
              onChangeText={(text) => {
                setCustomUrl(text);
                setPingResult(null);
              }}
              placeholder="https://api.shanutechx.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.urlInput}
            />

            {/* Ping Feedback */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <Pressable onPress={() => handleTestConnection()} disabled={pinging} style={styles.pingBtn}>
                <Ionicons name="flash-outline" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={styles.pingBtnText}>{pinging ? 'Testing...' : 'Test Ping'}</Text>
              </Pressable>
              {pingResult ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons
                    name={pingResult.type === 'success' ? 'checkmark-circle' : pingResult.type === 'warn' ? 'alert-circle' : 'close-circle'}
                    size={14}
                    color={pingResult.type === 'success' ? colors.success : pingResult.type === 'warn' ? colors.warning : colors.error}
                  />
                  <Text
                    style={[
                      styles.pingStatusText,
                      { color: pingResult.type === 'success' ? colors.success : pingResult.type === 'warn' ? colors.warning : colors.error }
                    ]}
                  >
                    {pingResult.text}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Button label="Cancel" variant="glass" size="sm" onPress={() => setModalVisible(false)} style={{ flex: 1 }} />
              <Button label="Save Endpoint" variant="primary" size="sm" onPress={handleSaveEndpoint} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  mono,
  highlight,
  last,
  rightIcon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  last?: boolean;
  rightIcon?: React.ReactNode;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text
          style={[
            styles.rowValue,
            mono && { fontFamily: 'monospace' },
            highlight && { color: colors.primary, fontFamily: fontFamily.bodyMedium },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
        {rightIcon}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  title: { fontFamily: fontFamily.head, fontSize: 22, color: colors.onSurface, marginBottom: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: { fontFamily: fontFamily.headExtrabold, fontSize: 26, color: colors.primary },
  name: { fontFamily: fontFamily.headSemibold, fontSize: 16, color: colors.onSurface },
  email: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  roleBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(207,188,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(207,188,255,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleText: { fontFamily: fontFamily.headSemibold, fontSize: 10, color: colors.primary, letterSpacing: 0.8 },
  sectionTitle: { fontFamily: fontFamily.headSemibold, fontSize: 13, color: colors.onSurface, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 13, color: colors.muted },
  rowValue: { fontFamily: fontFamily.body, fontSize: 13, color: colors.onSurface, flexShrink: 1, marginLeft: 12 },
  footer: { textAlign: 'center', fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, marginTop: 24 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.bgScreen2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, padding: 20 },
  modalTitle: { fontFamily: fontFamily.headSemibold, fontSize: 17, color: colors.onSurface },
  modalSubtitle: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: 14 },
  presetRow: {
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  presetRowActive: {
    backgroundColor: 'rgba(99,102,241,0.12)',
    borderColor: colors.primary,
  },
  presetLabel: { fontFamily: fontFamily.headSemibold, fontSize: 12, color: colors.onSurface },
  presetUrl: { fontFamily: 'monospace', fontSize: 10, color: colors.muted, marginTop: 2 },
  urlInput: {
    height: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    color: colors.onSurface,
    fontFamily: fontFamily.body,
    fontSize: 13,
  },
  pingBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pingBtnText: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: colors.primary },
  pingStatusText: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: colors.onSurfaceVariant },
});
