import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { useAuth } from '@/lib/AuthContext';
import { colors, fontFamily } from '@/theme/tokens';
import { API_BASE } from '@/lib/api';

export function ProfileScreen() {
  const { apiUser, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: 40 }}>
      <Text style={styles.title}>Profile</Text>

      <GlassCard style={{ alignItems: 'center', marginBottom: 20 }}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(apiUser?.email ?? '?')[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{apiUser?.displayName ?? apiUser?.email}</Text>
        <Text style={styles.email}>{apiUser?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{apiUser?.role?.toUpperCase()}</Text>
        </View>
      </GlassCard>

      <GlassCard style={{ marginBottom: 20 }}>
        <Row label="User ID" value={apiUser?.id ?? '—'} mono />
        <Row label="API Endpoint" value={API_BASE.replace(/^https?:\/\//, '')} mono />
        <Row label="App Version" value="2.0.0" mono last />
      </GlassCard>

      <Button label="Sign Out" variant="outlineDanger" onPress={handleSignOut} />

      <Text style={styles.footer}>ShanuTechX Admin · v2.0.0</Text>
    </ScrollView>

  );
}

function Row({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && { fontFamily: 'monospace' }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  title: { fontFamily: fontFamily.head, fontSize: 20, color: colors.onSurface, marginBottom: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontFamily: fontFamily.headExtrabold, fontSize: 28, color: colors.primary },
  name: { fontFamily: fontFamily.headSemibold, fontSize: 16, color: colors.onSurface },
  email: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  roleBadge: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(207,188,255,0.15)' },
  roleText: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: colors.primary, letterSpacing: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
  rowLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 13, color: colors.muted },
  rowValue: { fontFamily: fontFamily.body, fontSize: 13, color: colors.onSurface, flexShrink: 1, marginLeft: 12 },
  footer: { textAlign: 'center', fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, marginTop: 24 },
});
