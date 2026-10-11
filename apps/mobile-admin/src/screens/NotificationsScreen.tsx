import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/GlassCard';
import { api } from '@/lib/api';
import { colors, fontFamily, radius, spacing } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

interface ActionMeta {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}

const ACTION_CONFIG: Record<string, ActionMeta> = {
  // payments
  'payment.manual_approve': { icon: 'checkmark-circle-outline', color: colors.success, bg: 'rgba(34,197,94,0.15)' },
  'payment.manual_reject': { icon: 'close-circle-outline', color: colors.error, bg: 'rgba(239,68,68,0.15)' },
  // VPS
  'vps.terminate': { icon: 'trash-outline', color: colors.error, bg: 'rgba(239,68,68,0.15)' },
  'vps.reset_password': { icon: 'key-outline', color: colors.warning, bg: 'rgba(245,158,11,0.15)' },
  // containers / deployments
  'container.stop': { icon: 'stop-circle-outline', color: colors.warning, bg: 'rgba(245,158,11,0.15)' },
  'container.restart': { icon: 'sync-outline', color: colors.primary, bg: 'rgba(99,102,241,0.15)' },
  'deployment.create': { icon: 'rocket-outline', color: colors.cyan, bg: 'rgba(6,182,212,0.15)' },
  'deployment.stop': { icon: 'stop-circle-outline', color: colors.warning, bg: 'rgba(245,158,11,0.15)' },
  'deployment.restart': { icon: 'sync-outline', color: colors.primary, bg: 'rgba(99,102,241,0.15)' },
  'deployment.subdomain_update': { icon: 'globe-outline', color: colors.primary, bg: 'rgba(99,102,241,0.15)' },
  'deployment.delete': { icon: 'trash-outline', color: colors.error, bg: 'rgba(239,68,68,0.15)' },
  // catalog
  'product.create': { icon: 'sparkles-outline', color: colors.cyan, bg: 'rgba(6,182,212,0.15)' },
  'plan.create': { icon: 'cube-outline', color: colors.cyan, bg: 'rgba(6,182,212,0.15)' },
  // nodes
  'node.create': { icon: 'server-outline', color: colors.cyan, bg: 'rgba(6,182,212,0.15)' },
  'node.delete': { icon: 'trash-outline', color: colors.error, bg: 'rgba(239,68,68,0.15)' },
  // users
  'user.role_change': { icon: 'shield-checkmark-outline', color: colors.primary, bg: 'rgba(99,102,241,0.15)' },
  'user.ban': { icon: 'ban-outline', color: colors.error, bg: 'rgba(239,68,68,0.15)' },
};

const DEFAULT_ACTION: ActionMeta = {
  icon: 'document-text-outline',
  color: colors.primary,
  bg: 'rgba(99,102,241,0.1)',
};

function formatActionTitle(action: string): string {
  return action
    .split(/[._]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<Array<{
    id: string;
    action: string;
    target: string | null;
    createdAt: string;
    admin: { email: string };
  }> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const { entries } = await api.auditLog.recent(50);
      setEntries(entries);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit activity');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Platform Audit Trail</Text>
          <Text style={styles.headerSubtitle}>Real-time privileged staff & system actions</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{entries?.length ?? 0}</Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={15} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={entries ?? []}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          !entries ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={styles.muted}>Loading audit stream…</Text>
            </View>
          ) : (
            <GlassCard style={{ padding: 28, alignItems: 'center', marginTop: 16 }}>
              <Ionicons name="document-text-outline" size={34} color={colors.muted} style={{ marginBottom: 8 }} />
              <Text style={[styles.muted, { textAlign: 'center' }]}>No privileged actions recorded.</Text>
            </GlassCard>
          )
        }
        renderItem={({ item }) => {
          const cfg = ACTION_CONFIG[item.action] ?? DEFAULT_ACTION;
          return (
            <GlassCard style={styles.entryCard}>
              <View style={[styles.iconBox, { backgroundColor: cfg.bg }]}>
                <Ionicons name={cfg.icon} size={18} color={cfg.color} />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.actionTitle}>{formatActionTitle(item.action)}</Text>
                {item.target ? (
                  <Text style={styles.targetText} numberOfLines={1}>
                    Target: <Text style={{ fontFamily: 'monospace', color: colors.onSurfaceVariant }}>{item.target}</Text>
                  </Text>
                ) : null}
                <View style={styles.metaRow}>
                  <Ionicons name="person-outline" size={11} color={colors.muted} />
                  <Text style={styles.meta}>
                    {item.admin?.email ?? 'System Automated'}
                  </Text>
                </View>
              </View>
              <Text style={styles.timestamp}>
                {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </GlassCard>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: { fontFamily: fontFamily.head, fontSize: 18, color: colors.onSurface },
  headerSubtitle: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, marginTop: 1 },
  countBadge: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
  },
  countText: { fontFamily: fontFamily.headSemibold, fontSize: 12, color: colors.primary },
  errorBox: {
    margin: 16,
    padding: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: { color: colors.error, fontSize: 12, fontFamily: fontFamily.bodyMedium, flex: 1 },
  muted: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 13 },
  entryCard: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionTitle: { fontFamily: fontFamily.headSemibold, fontSize: 13, color: colors.onSurface },
  targetText: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  meta: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted },
  timestamp: { fontFamily: fontFamily.body, fontSize: 10, color: colors.muted, textAlign: 'right', flexShrink: 0 },
});
