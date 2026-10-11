import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/GlassCard';
import { api, AnalyticsSummary } from '@/lib/api';
import { colors, fontFamily, radius, spacing } from '@/theme/tokens';

const RANGES = [
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: '1Y', value: '1y' },
  { label: 'ALL', value: 'all' },
];

function formatLkr(n?: number | null): string {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return `Rs ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `Rs ${(n / 1_000).toFixed(1)}k`;
  return `Rs ${n.toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

export function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<string>('30d');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<{ month: string; val: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (r?: string) => {
      try {
        const targetRange = r || range;
        const data = await api.analytics.summary(targetRange);
        setSummary(data);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load enterprise analytics');
      }
    },
    [range]
  );

  useFocusEffect(
    useCallback(() => {
      load(range);
    }, [load, range])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load(range);
    setRefreshing(false);
  }

  function handleSelectRange(newRange: string) {
    setRange(newRange);
    load(newRange);
  }

  const months = summary ? Object.entries(summary.revenueByMonth) : [];
  const maxRevenue = Math.max(1, ...months.map(([, v]) => v));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: 110 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Enterprise Intelligence</Text>
          <Text style={styles.subtitle}>Financial metrics, MRR/ARR, fleet & workload analytics</Text>
        </View>
      </View>

      {/* Timeframe Chips */}
      <View style={styles.rangeChipsRow}>
        {RANGES.map((r) => {
          const isActive = range === r.value;
          return (
            <Pressable
              key={r.value}
              onPress={() => handleSelectRange(r.value)}
              style={[styles.rangeChip, isActive && styles.rangeChipActive]}
            >
              <Text style={[styles.rangeChipText, isActive && styles.rangeChipTextActive]}>
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={15} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Primary Financial Metric Tiles */}
      <View style={styles.statsRow}>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statLabel}>Period Revenue ({range.toUpperCase()})</Text>
          <Text style={styles.statValue}>
            {summary ? formatLkr(summary.revenueLast30dLkr) : '—'}
          </Text>
          {summary && summary.revenueGrowthPct !== undefined && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons
                name={summary.revenueGrowthPct >= 0 ? 'trending-up' : 'trending-down'}
                size={13}
                color={summary.revenueGrowthPct >= 0 ? colors.success : colors.error}
              />
              <Text style={[styles.trendText, { color: summary.revenueGrowthPct >= 0 ? colors.success : colors.error }]}>
                {summary.revenueGrowthPct >= 0 ? '+' : ''}
                {summary.revenueGrowthPct.toFixed(1)}% vs prev
              </Text>
            </View>
          )}
        </GlassCard>

        <GlassCard style={styles.statCard}>
          <Text style={styles.statLabel}>Monthly Recurring (MRR)</Text>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {summary ? formatLkr(summary.mrrLkr) : '—'}
          </Text>
          <Text style={styles.statSub}>
            ARR: {summary ? formatLkr(summary.arrLkr) : '—'}
          </Text>
        </GlassCard>
      </View>

      {/* Secondary Metrics */}
      <View style={styles.statsRow}>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statLabel}>Active Subscriptions</Text>
          <Text style={styles.statValue}>
            {summary ? summary.activeSubscriptions : '—'}
          </Text>
          <Text style={styles.statSub}>
            Cancelled ({range}): {summary ? summary.cancelledSubscriptionsLast30d : '0'}
          </Text>
        </GlassCard>

        <GlassCard style={styles.statCard}>
          <Text style={styles.statLabel}>Customer Base</Text>
          <Text style={styles.statValue}>
            {summary ? summary.totalCustomers : '—'}
          </Text>
          <Text style={styles.statSub}>
            Platform Uptime: {summary?.uptimePct ?? 99.9}%
          </Text>
        </GlassCard>
      </View>

      {/* Monthly Revenue Bar Chart */}
      <Text style={styles.sectionTitle}>Monthly Revenue Trend</Text>
      <GlassCard style={{ padding: 16 }}>
        {selectedMonth ? (
          <View style={styles.selectedMonthBanner}>
            <Ionicons name="calendar-outline" size={14} color={colors.primary} />
            <Text style={styles.selectedMonthText}>
              {selectedMonth.month}: <Text style={{ color: colors.primary, fontFamily: fontFamily.headSemibold }}>{formatLkr(selectedMonth.val)}</Text>
            </Text>
          </View>
        ) : null}

        {months.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Ionicons name="bar-chart-outline" size={28} color={colors.muted} style={{ marginBottom: 6 }} />
            <Text style={styles.muted}>No revenue orders recorded yet.</Text>
          </View>
        ) : (
          <View style={styles.chartContainer}>
            <View style={styles.chart}>
              {months.map(([month, value]) => {
                const heightPct = Math.max(6, (value / maxRevenue) * 100);
                const isSelected = selectedMonth?.month === month;
                return (
                  <Pressable
                    key={month}
                    style={styles.barColumn}
                    onPress={() => setSelectedMonth({ month, val: value })}
                  >
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          { height: `${heightPct}%` },
                          isSelected && { backgroundColor: '#a5b4fc', borderWidth: 1, borderColor: '#ffffff' },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barLabel, isSelected && { color: colors.primary, fontFamily: fontFamily.headSemibold }]}>
                      {month.slice(5)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </GlassCard>

      {/* Top Services Leaderboard */}
      <Text style={styles.sectionTitle}>Top Performing Services</Text>
      {!summary?.topServices?.length && !summary?.topServicesByOrderCount?.length ? (
        <GlassCard style={{ padding: 20, alignItems: 'center' }}>
          <Text style={styles.muted}>No service orders recorded in this window.</Text>
        </GlassCard>
      ) : (
        (summary.topServices || summary.topServicesByOrderCount || []).map((s: any, idx: number) => {
          const serviceTitle = s.title || s.name || 'Cloud Service';
          const serviceCategory = s.category || s.type || 'Standard';
          const orderCount = s.ordersCount ?? s.count ?? 0;
          const revLkr = s.revenueLkr ?? 0;

          return (
            <GlassCard key={idx} style={styles.leaderboardCard}>
              <View style={styles.leaderboardRank}>
                <Text style={styles.rankText}>#{idx + 1}</Text>
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.itemTitle} numberOfLines={1}>{serviceTitle}</Text>
                <Text style={styles.itemSub}>{serviceCategory.replace(/_/g, ' ')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.itemOrders}>{orderCount} orders</Text>
                {revLkr > 0 && (
                  <Text style={styles.itemRevenue}>{formatLkr(revLkr)}</Text>
                )}
              </View>
            </GlassCard>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  header: { marginBottom: 14 },
  title: { fontFamily: fontFamily.head, fontSize: 22, color: colors.onSurface },
  subtitle: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  rangeChipsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  rangeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  rangeChipActive: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  rangeChipText: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: colors.muted },
  rangeChipTextActive: { color: colors.primary },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  errorText: { color: colors.error, fontSize: 12, fontFamily: fontFamily.bodyMedium, flex: 1 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard: { flex: 1, padding: 14 },
  statLabel: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, marginBottom: 4 },
  statValue: { fontFamily: fontFamily.headExtrabold, fontSize: 20, color: colors.onSurface },
  trendText: { fontFamily: fontFamily.bodyMedium, fontSize: 10 },
  statSub: { fontFamily: fontFamily.body, fontSize: 10, color: colors.muted, marginTop: 4 },
  sectionTitle: { fontFamily: fontFamily.headSemibold, fontSize: 15, color: colors.onSurface, marginTop: 18, marginBottom: 10 },
  muted: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 13 },
  selectedMonthBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.2)',
  },
  selectedMonthText: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.onSurface },
  chartContainer: { height: 150 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 140, gap: 6 },
  barColumn: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: { width: '80%', height: '80%', justifyContent: 'flex-end' },
  bar: { width: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  barLabel: { fontFamily: fontFamily.body, fontSize: 9, color: colors.muted, marginTop: 6 },
  leaderboardCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, padding: 12 },
  leaderboardRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankText: { fontFamily: fontFamily.headSemibold, fontSize: 12, color: colors.primary },
  itemTitle: { fontFamily: fontFamily.headSemibold, fontSize: 13, color: colors.onSurface },
  itemSub: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, marginTop: 2, textTransform: 'capitalize' },
  itemOrders: { fontFamily: fontFamily.headSemibold, fontSize: 13, color: colors.onSurface },
  itemRevenue: { fontFamily: fontFamily.body, fontSize: 11, color: colors.primary, marginTop: 2 },
});
