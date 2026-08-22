import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useFocusEffect, useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/GlassCard';
import { useAuth } from '@/lib/AuthContext';
import { api, AnalyticsSummary, Payment, Deployment } from '@/lib/api';
import { colors, fontFamily, spacing, statusStyle } from '@/theme/tokens';
import type { RootStackParamList, MainTabParamList } from '@/navigation/types';

type DashboardNav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Dashboard'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function formatLkr(n: number): string {
  return `Rs ${n.toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

export function DashboardScreen() {
  const navigation = useNavigation<DashboardNav>();
  const { apiUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [pendingPayments, setPendingPayments] = useState<Payment[] | null>(null);
  const [activeDeployments, setActiveDeployments] = useState<Deployment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [analytics, payments, deps] = await Promise.all([
        api.analytics.summary(),
        api.payments.reviewQueue(),
        api.deployments.list({ status: 'running', take: 5 }),
      ]);
      setSummary(analytics);
      setPendingPayments(payments.payments);
      setActiveDeployments(deps.deployments);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {apiUser?.displayName ?? apiUser?.email?.split('@')[0] ?? 'there'}</Text>
          <Text style={styles.role}>{apiUser?.role?.toUpperCase()}</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Notifications')} style={styles.bell}>
          <Text style={{ fontSize: 18 }}>🔔</Text>
          {pendingPayments && pendingPayments.length > 0 && <View style={styles.bellDot} />}
        </Pressable>
      </View>

      {error && (
        <GlassCard style={{ marginBottom: 16, borderColor: 'rgba(239,68,68,0.4)' }}>
          <Text style={{ color: colors.error, fontFamily: fontFamily.bodyMedium }}>{error}</Text>
        </GlassCard>
      )}

      <View style={styles.statsGrid}>
        <StatCard
          label="Revenue (30d)"
          value={summary ? formatLkr(summary.revenueLast30dLkr) : '—'}
          gradient={[colors.primary, colors.primaryDark]}
        />
        <StatCard
          label="Active Subs"
          value={summary ? String(summary.activeSubscriptions) : '—'}
          gradient={['#22D3EE', '#0891B2']}
        />
        <StatCard
          label="Customers"
          value={summary ? String(summary.totalCustomers) : '—'}
          gradient={['#4ADE80', '#16A34A']}
        />
        <StatCard
          label="Running"
          value={String(activeDeployments.length)}
          gradient={['#CFBCFF', '#6750A4']}
          onPress={() => navigation.navigate('Deployments')}
        />
      </View>

      {/* Quick access row */}
      <Pressable
        onPress={() => navigation.navigate('Payments')}
        style={styles.quickAccessRow}
      >
        <GlassCard style={styles.quickAccessCard}>
          <Text style={styles.quickAccessIcon}>💳</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.quickAccessLabel}>Payment Review Queue</Text>
            <Text style={styles.quickAccessSub}>
              {pendingPayments ? `${pendingPayments.length} awaiting review` : 'Loading…'}
            </Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
        </GlassCard>
      </Pressable>

      <Text style={styles.sectionTitle}>Needs your attention</Text>
      {pendingPayments === null ? (
        <GlassCard><Text style={styles.muted}>Loading…</Text></GlassCard>
      ) : pendingPayments.length === 0 ? (
        <GlassCard><Text style={styles.muted}>No payments waiting for review. 🎉</Text></GlassCard>
      ) : (
        pendingPayments.slice(0, 3).map((p) => (
          <Pressable key={p.id} onPress={() => navigation.navigate('Payments')}>
            <GlassCard style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {p.order?.user?.email ?? 'Unknown customer'}
                </Text>
                <Text style={styles.itemAmount}>
                  {p.order ? formatLkr(p.order.totalLkr) : ''}
                </Text>
              </View>
              <Text style={styles.itemSub}>Order #{p.orderId.slice(0, 8).toUpperCase()} · awaiting review</Text>
            </GlassCard>
          </Pressable>
        ))
      )}

      {activeDeployments.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Active deployments</Text>
          {activeDeployments.map((dep) => {
            const s = statusStyle(dep.status);
            return (
              <Pressable
                key={dep.id}
                onPress={() => navigation.navigate('DeploymentDetail', { deploymentId: dep.id, name: dep.name })}
              >
                <GlassCard style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{dep.name}</Text>
                    <View style={[styles.depBadge, { backgroundColor: s.bg }]}>
                      <View style={[styles.depDot, { backgroundColor: s.dot }]} />
                      <Text style={[styles.depBadgeText, { color: s.text }]}>{dep.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.itemSub}>
                    {dep.user?.email ?? 'unknown'} · {dep.node?.label ?? 'No node'}
                  </Text>
                </GlassCard>
              </Pressable>
            );
          })}
        </>
      )}

      {summary && summary.nodeUtilization.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Node health</Text>
          {summary.nodeUtilization.map((n) => (
            <GlassCard key={n.label} style={{ marginBottom: 10 }}>
              <Text style={styles.itemTitle}>{n.label}</Text>
              <Text style={styles.itemSub}>
                CPU {n.cpuUsedPct ?? '—'}% · RAM {n.ramUsedPct ?? '—'}% · Disk {n.diskUsedPct ?? '—'}%
              </Text>
            </GlassCard>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, gradient, onPress }: { label: string; value: string; gradient: [string, string]; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.statCardWrapper} disabled={!onPress}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statCard}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontFamily: fontFamily.head, fontSize: 20, color: colors.onSurface },
  role: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: colors.primary, letterSpacing: 1, marginTop: 2 },
  bell: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.glassBorder },
  bellDot: { position: 'absolute', top: 8, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.errorStrong },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, columnGap: spacing.md, marginBottom: 8 },
  statCardWrapper: { width: '47%' },
  statCard: { borderRadius: 18, padding: 16, minHeight: 90, justifyContent: 'space-between' },
  statValue: { fontFamily: fontFamily.headExtrabold, fontSize: 20, color: '#12081f' },
  statLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: 'rgba(18,8,31,0.75)', marginTop: 4 },
  sectionTitle: { fontFamily: fontFamily.headSemibold, fontSize: 15, color: colors.onSurface, marginTop: 24, marginBottom: 10 },
  muted: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 13 },
  itemTitle: { fontFamily: fontFamily.bodySemibold, fontSize: 14, color: colors.onSurface, flexShrink: 1 },
  itemAmount: { fontFamily: fontFamily.headSemibold, fontSize: 14, color: colors.primary },
  itemSub: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginTop: 4 },
  depBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, marginLeft: 8 },
  depDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  depBadgeText: { fontFamily: fontFamily.bodyMedium, fontSize: 11 },
  quickAccessRow: { marginBottom: 4 },
  quickAccessCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  quickAccessIcon: { fontSize: 22 },
  quickAccessLabel: { fontFamily: fontFamily.bodySemibold, fontSize: 14, color: colors.onSurface },
  quickAccessSub: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginTop: 2 },
});

