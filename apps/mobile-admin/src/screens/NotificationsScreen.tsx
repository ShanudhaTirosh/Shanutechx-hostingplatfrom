import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/GlassCard';
import { api } from '@/lib/api';
import { colors, fontFamily } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

const ACTION_ICON: Record<string, string> = {
  // payments
  'payment.manual_approve': '[OK]',
  'payment.manual_reject': '[X]',
  // VPS
  'vps.terminate': '[VPS]',
  'vps.reset_password': '[KEY]',
  // containers / deployments
  'container.stop': '[STOP]',
  'container.restart': '[SYNC]',
  'deployment.create': '[NEW]',
  'deployment.stop': '[STOP]',
  'deployment.restart': '[SYNC]',
  'deployment.subdomain_update': '[LINK]',
  'deployment.delete': '[DEL]',
  // catalog
  'product.create': '[NEW]',
  'plan.create': '[NEW]',
  'product.delete': '[DEL]',
  // nodes
  'node.create': '[NODE]',
  'node.delete': '[DEL]',
  // users
  'user.role_change': '[USER]',
  'user.ban': '[BAN]',
};

function actionLabel(action: string): string {
  return action.replace(/[._]/g, ' ');
}

export function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<Array<{ id: string; action: string; target: string | null; createdAt: string; admin: { email: string } }> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const { entries } = await api.auditLog.recent();
      setEntries(entries);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ color: colors.onSurface, fontSize: 18 }}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Recent Activity</Text>
      </View>

      <FlatList
        data={entries ?? []}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          !entries ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : error ? (
            <Text style={{ color: colors.error }}>{error}</Text>
          ) : (
            <GlassCard><Text style={styles.muted}>No recent activity.</Text></GlassCard>
          )
        }
        renderItem={({ item }) => (
          <GlassCard style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 12, fontFamily: fontFamily.mono, color: colors.primary }}>{ACTION_ICON[item.action] ?? '[LOG]'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.action}>{actionLabel(item.action)}</Text>
              <Text style={styles.meta}>
                {item.admin.email} · {new Date(item.createdAt).toLocaleString()}
              </Text>
            </View>
          </GlassCard>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass },
  headerTitle: { fontFamily: fontFamily.head, fontSize: 18, color: colors.onSurface },
  muted: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 30 },
  action: { fontFamily: fontFamily.bodySemibold, fontSize: 13, color: colors.onSurface, textTransform: 'capitalize' },
  meta: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, marginTop: 3 },
});
