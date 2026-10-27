import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useFocusEffect, useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/GlassCard';
import { useAuth } from '@/lib/AuthContext';
import { api, AnalyticsSummary, Payment, Deployment, Node } from '@/lib/api';
import { colors, fontFamily, radius, spacing, statusStyle } from '@/theme/tokens';
import type { RootStackParamList, MainTabParamList } from '@/navigation/types';

type DashboardNav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Dashboard'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function formatLkr(n: number | null | undefined): string {
  if (n === undefined || n === null || isNaN(n)) return 'Rs 0';
  return `Rs ${Number(n).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardScreen() {
  const navigation = useNavigation<DashboardNav>();
  const { apiUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [pendingPayments, setPendingPayments] = useState<Payment[] | null>(null);
  const [activeDeployments, setActiveDeployments] = useState<Deployment[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [analytics, paymentsData, depsData, nodesData] = await Promise.all([
        api.analytics.summary('30d').catch(() => null),
        api.payments.reviewQueue('manual_review').catch(() => ({ payments: [] })),
        api.deployments.list({ take: 6 }).catch(() => ({ deployments: [] })),
        api.nodes.list().catch(() => ({ nodes: [] })),
      ]);

      if (analytics) setSummary(analytics);
      setPendingPayments(paymentsData.payments || []);
      setActiveDeployments(depsData.deployments || []);
      setNodes(nodesData.nodes || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
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

  const runningCount = activeDeployments.filter((d) => d.status === 'running').length;
  const pendingPaymentsCount = pendingPayments?.length ?? 0;
  const isDevSuperuser = apiUser?.role === 'dev';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greetingSub}>{getGreeting()},</Text>
          <Text style={styles.greetingName} numberOfLines={1}>
            {apiUser?.displayName || apiUser?.email?.split('@')[0] || 'Administrator'}
          </Text>
          <View style={[styles.roleBadge, isDevSuperuser && styles.devRoleBadge]}>
            <View style={[styles.roleDot, isDevSuperuser && { backgroundColor: colors.cyan }]} />
            <Text style={[styles.roleText, isDevSuperuser && { color: colors.cyan }]}>
              {isDevSuperuser ? 'DEV SUPERUSER' : (apiUser?.role || 'STAFF').toUpperCase()}
            </Text>
          </View>
        </View>

        <Pressable onPress={() => navigation.navigate('Notifications')} style={styles.bell}>
          <Ionicons name="notifications-outline" size={20} color={colors.onSurface} />
          {pendingPaymentsCount > 0 && <View style={styles.bellDot} />}
        </Pressable>
      </View>

      {error && (
        <GlassCard style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </GlassCard>
      )}

      {/* Primary KPI Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          label="Revenue (30d)"
          value={summary ? formatLkr(summary.revenueLast30dLkr) : 'Loading…'}
          subValue={summary?.mrrLkr ? `MRR: ${formatLkr(summary.mrrLkr)}` : undefined}
          icon="trending-up-outline"
          gradient={[colors.primary, colors.primaryDark]}
        />
        <StatCard
          label="Active Subs"
          value={summary ? String(summary.activeSubscriptions) : '—'}
          subValue={summary?.cancelledSubscriptionsLast30d ? `${summary.cancelledSubscriptionsLast30d} cancelled` : '0 churn'}
          icon="repeat-outline"
          gradient={['#22D3EE', '#0891B2']}
        />
        <StatCard
          label="Customers"
          value={summary ? String(summary.totalCustomers) : '—'}
          subValue="Registered users"
          icon="people-outline"
          gradient={['#4ADE80', '#16A34A']}
        />
        <StatCard
          label="Running Apps"
          value={String(runningCount)}
          subValue={`of ${activeDeployments.length} total`}
          icon="rocket-outline"
          gradient={['#CFBCFF', '#6750A4']}
          onPress={() => navigation.navigate('Deployments')}
        />
      </View>

      {/* Quick Navigation Action Hub */}
      <View style={styles.hubGrid}>
        <Pressable onPress={() => navigation.navigate('Payments')} style={styles.hubButton}>
          <GlassCard style={styles.hubCard}>
            <View style={styles.hubIconBox}>
              <Ionicons name="card-outline" size={22} color={colors.primary} />
              {pendingPaymentsCount > 0 && (
                <View style={styles.hubBadge}>
                  <Text style={styles.hubBadgeText}>{pendingPaymentsCount}</Text>
                </View>
              )}
            </View>
            <Text style={styles.hubTitle}>Review Payments</Text>
            <Text style={styles.hubSub}>
              {pendingPaymentsCount > 0 ? `${pendingPaymentsCount} waiting` : 'Up to date'}
            </Text>
          </GlassCard>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Deployments')} style={styles.hubButton}>
          <GlassCard style={styles.hubCard}>
            <View style={styles.hubIconBox}>
              <Ionicons name="rocket-outline" size={22} color={colors.cyan} />
            </View>
            <Text style={styles.hubTitle}>Deployments</Text>
            <Text style={styles.hubSub}>{activeDeployments.length} workloads</Text>
          </GlassCard>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Nodes')} style={styles.hubButton}>
          <GlassCard style={styles.hubCard}>
            <View style={styles.hubIconBox}>
              <Ionicons name="server-outline" size={22} color="#a78bfa" />
            </View>
            <Text style={styles.hubTitle}>Server Nodes</Text>
            <Text style={styles.hubSub}>{nodes.length} cluster hosts</Text>
          </GlassCard>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Tickets')} style={styles.hubButton}>
          <GlassCard style={styles.hubCard}>
            <View style={styles.hubIconBox}>
              <Ionicons name="chatbubbles-outline" size={22} color="#f59e0b" />
            </View>
            <Text style={styles.hubTitle}>Support Desk</Text>
            <Text style={styles.hubSub}>Customer tickets</Text>
          </GlassCard>
        </Pressable>
      </View>

      {/* Action Required: Payment Approvals */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Payments Needing Review</Text>
        <Pressable onPress={() => navigation.navigate('Payments')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={styles.seeAllText}>See all ({pendingPaymentsCount})</Text>
          <Ionicons name="chevron-forward" size={12} color={colors.primary} />
        </Pressable>
      </View>

      {pendingPayments === null ? (
        <GlassCard><Text style={styles.muted}>Loading payments queue…</Text></GlassCard>
      ) : pendingPayments.length === 0 ? (
        <GlassCard style={{ alignItems: 'center', paddingVertical: 18 }}>
          <Ionicons name="checkmark-circle-outline" size={30} color={colors.success} style={{ marginBottom: 6 }} />
          <Text style={[styles.itemTitle, { color: colors.success }]}>All payments reviewed</Text>
          <Text style={[styles.muted, { marginTop: 2 }]}>No manual verification slips awaiting review.</Text>
        </GlassCard>
      ) : (
        pendingPayments.slice(0, 3).map((p) => (
          <Pressable key={p.id} onPress={() => navigation.navigate('Payments')}>
            <GlassCard style={styles.queueCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {p.order?.user?.email || 'Unknown customer'}
                  </Text>
                  <Text style={styles.itemSub}>
                    Order #{p.orderId.slice(0, 8).toUpperCase()} · {p.method.replace('_', ' ')}
                  </Text>
                </View>
                <Text style={styles.itemAmount}>
                  {formatLkr(p.order?.totalLkr ?? p.order?.total)}
                </Text>
              </View>
            </GlassCard>
          </Pressable>
        ))
      )}

      {/* Active Workloads */}
      <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
        <Text style={styles.sectionTitle}>Recent Deployments</Text>
        <Pressable onPress={() => navigation.navigate('Deployments')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={styles.seeAllText}>View all</Text>
          <Ionicons name="chevron-forward" size={12} color={colors.primary} />
        </Pressable>
      </View>

      {activeDeployments.length === 0 ? (
        <GlassCard><Text style={styles.muted}>No deployments found.</Text></GlassCard>
      ) : (
        activeDeployments.slice(0, 4).map((dep) => {
          const s = statusStyle(dep.status);
          return (
            <Pressable
              key={dep.id}
              onPress={() => navigation.navigate('DeploymentDetail', { deploymentId: dep.id, name: dep.name })}
            >
              <GlassCard style={styles.depCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{dep.name}</Text>
                    <Text style={styles.itemSub} numberOfLines={1}>
                      {dep.publicUrl ? dep.publicUrl.replace(/^https?:\/\//, '') : dep.user?.email || 'Standalone'}
                    </Text>
                  </View>
                  <View style={[styles.depBadge, { backgroundColor: s.bg }]}>
                    <View style={[styles.depDot, { backgroundColor: s.dot }]} />
                    <Text style={[styles.depBadgeText, { color: s.text }]}>{dep.status}</Text>
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          );
        })
      )}

      {/* Node Fleet Overview */}
      {nodes.length > 0 && (
        <>
          <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
            <Text style={styles.sectionTitle}>Compute Cluster Nodes</Text>
            <Pressable onPress={() => navigation.navigate('Nodes')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={styles.seeAllText}>Manage fleet</Text>
              <Ionicons name="chevron-forward" size={12} color={colors.primary} />
            </Pressable>
          </View>

          {nodes.slice(0, 3).map((n) => (
            <GlassCard key={n.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.itemTitle}>{n.label}</Text>
                <View style={[styles.statusTag, { backgroundColor: n.status === 'online' ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)' }]}>
                  <Text style={[styles.statusTagText, { color: n.status === 'online' ? colors.success : colors.error }]}>
                    {n.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.itemSub}>
                CPU: {n.cpuUsedPct !== null ? `${n.cpuUsedPct}%` : '—'} · RAM: {n.ramUsedPct !== null ? `${n.ramUsedPct}%` : '—'} ({n.totalRamGb || '—'} GB) · {n.deploymentCount} apps
              </Text>
            </GlassCard>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function StatCard({
  label,
  value,
  subValue,
  icon,
  gradient,
  onPress,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  gradient: [string, string];
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.statCardWrapper} disabled={!onPress}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.statLabel}>{label}</Text>
          {icon && <Ionicons name={icon} size={14} color="rgba(18,8,31,0.65)" />}
        </View>
        <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
        {subValue && <Text style={styles.statSub} numberOfLines={1}>{subValue}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greetingSub: { fontFamily: fontFamily.body, fontSize: 13, color: colors.muted },
  greetingName: { fontFamily: fontFamily.head, fontSize: 22, color: colors.onSurface, marginTop: 2 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    backgroundColor: 'rgba(207,188,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(207,188,255,0.25)',
  },
  devRoleBadge: {
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderColor: 'rgba(34,211,238,0.3)',
  },
  roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  roleText: { fontFamily: fontFamily.headSemibold, fontSize: 10, color: colors.primary, letterSpacing: 0.5 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    position: 'relative',
  },
  bellIcon: { fontSize: 18 },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.errorStrong,
    borderWidth: 1.5,
    borderColor: colors.bgBase,
  },
  errorCard: { marginBottom: 16, borderColor: 'rgba(239,68,68,0.4)' },
  errorText: { color: colors.error, fontFamily: fontFamily.bodyMedium, fontSize: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, columnGap: 12, marginBottom: 16 },
  statCardWrapper: { width: '48%' },
  statCard: { borderRadius: 18, padding: 14, minHeight: 96, justifyContent: 'space-between' },
  statLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: 'rgba(18,8,31,0.7)' },
  statValue: { fontFamily: fontFamily.headExtrabold, fontSize: 18, color: '#12081f', marginVertical: 2 },
  statSub: { fontFamily: fontFamily.bodyMedium, fontSize: 10, color: 'rgba(18,8,31,0.65)' },
  hubGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  hubButton: { width: '48%' },
  hubCard: { padding: 14, borderRadius: radius.md },
  hubIconBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  hubEmoji: { fontSize: 20 },
  hubBadge: { backgroundColor: colors.errorStrong, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99 },
  hubBadgeText: { color: '#fff', fontSize: 10, fontFamily: fontFamily.headSemibold },
  hubTitle: { fontFamily: fontFamily.headSemibold, fontSize: 13, color: colors.onSurface },
  hubSub: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, marginTop: 2 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontFamily: fontFamily.headSemibold, fontSize: 15, color: colors.onSurface },
  seeAllText: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.primary },
  muted: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 12 },
  queueCard: { marginBottom: 10 },
  depCard: { marginBottom: 10 },
  itemTitle: { fontFamily: fontFamily.bodySemibold, fontSize: 13, color: colors.onSurface },
  itemAmount: { fontFamily: fontFamily.headSemibold, fontSize: 14, color: colors.primary },
  itemSub: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, marginTop: 3 },
  depBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
  depDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  depBadgeText: { fontFamily: fontFamily.bodyMedium, fontSize: 11, textTransform: 'capitalize' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusTagText: { fontFamily: fontFamily.bodyMedium, fontSize: 10, fontWeight: '700' },
});
