import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/GlassCard';
import { api, AnalyticsSummary } from '@/lib/api';
import { colors, fontFamily } from '@/theme/tokens';

function formatLkr(n: number): string {
  return `Rs ${n.toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

export function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.analytics.summary();
      setSummary(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const months = summary ? Object.entries(summary.revenueByMonth) : [];
  const maxRevenue = Math.max(1, ...months.map(([, v]) => v));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Revenue & Analytics</Text>

      {error && <Text style={{ color: colors.error, marginBottom: 12 }}>{error}</Text>}

      <View style={styles.statsRow}>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statValue}>{summary ? formatLkr(summary.revenueLast30dLkr) : '—'}</Text>
          <Text style={styles.statLabel}>Revenue (30d)</Text>
        </GlassCard>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statValue}>{summary ? summary.activeSubscriptions : '—'}</Text>
          <Text style={styles.statLabel}>Active Subs</Text>
        </GlassCard>
      </View>
      <View style={styles.statsRow}>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statValue}>{summary ? summary.totalCustomers : '—'}</Text>
          <Text style={styles.statLabel}>Total Customers</Text>
        </GlassCard>
        <GlassCard style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.error }]}>{summary ? summary.cancelledSubscriptionsLast30d : '—'}</Text>
          <Text style={styles.statLabel}>Cancelled (30d)</Text>
        </GlassCard>
      </View>

      <Text style={styles.sectionTitle}>Revenue by month</Text>
      <GlassCard>
        {months.length === 0 ? (
          <Text style={styles.muted}>No revenue data yet.</Text>
        ) : (
          <View style={styles.chart}>
            {months.map(([month, value]) => (
              <View key={month} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View style={[styles.bar, { height: `${Math.max(4, (value / maxRevenue) * 100)}%` }]} />
                </View>
                <Text style={styles.barLabel}>{month.slice(5)}</Text>
              </View>
            ))}
          </View>
        )}
      </GlassCard>

      <Text style={styles.sectionTitle}>Top services by orders</Text>
      {!summary?.topServicesByOrderCount?.length ? (
        <GlassCard><Text style={styles.muted}>No order data yet.</Text></GlassCard>
      ) : (
        summary.topServicesByOrderCount.map((s) => (
          <GlassCard key={s.serviceId} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.itemTitle}>{s.name}</Text>
              <Text style={styles.itemCount}>{s.count} orders</Text>
            </View>
            <Text style={styles.itemSub}>{s.type.replace(/_/g, ' ')}</Text>
          </GlassCard>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  title: { fontFamily: fontFamily.head, fontSize: 20, color: colors.onSurface, marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1 },
  statValue: { fontFamily: fontFamily.headExtrabold, fontSize: 18, color: colors.onSurface },
  statLabel: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, marginTop: 4 },
  sectionTitle: { fontFamily: fontFamily.headSemibold, fontSize: 15, color: colors.onSurface, marginTop: 20, marginBottom: 10 },
  muted: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 13 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 140, gap: 6 },
  barColumn: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: { width: '70%', height: '85%', justifyContent: 'flex-end' },
  bar: { width: '100%', backgroundColor: colors.primary, borderRadius: 4, minHeight: 4 },
  barLabel: { fontFamily: fontFamily.body, fontSize: 9, color: colors.muted, marginTop: 6 },
  itemTitle: { fontFamily: fontFamily.bodySemibold, fontSize: 13, color: colors.onSurface },
  itemCount: { fontFamily: fontFamily.headSemibold, fontSize: 13, color: colors.primary },
  itemSub: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, marginTop: 4, textTransform: 'capitalize' },
});
