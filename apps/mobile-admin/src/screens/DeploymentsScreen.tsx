import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  TextInput,
  Linking,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/GlassCard';
import { api, Deployment } from '@/lib/api';
import { colors, fontFamily, spacing, statusStyle, radius } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUSES = ['all', 'running', 'building', 'failed', 'stopped'] as const;
type StatusFilter = (typeof STATUSES)[number];

function StatusDot({ status }: { status: string }) {
  const s = statusStyle(status);
  return <View style={[styles.dot, { backgroundColor: s.dot }]} />;
}

function StatusBadge({ status }: { status: string }) {
  const s = statusStyle(status);
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <StatusDot status={status} />
      <Text style={[styles.badgeText, { color: s.text }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

export function DeploymentsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (statusOverride?: StatusFilter) => {
      try {
        const status = statusOverride ?? filter;
        const { deployments: list, total: t } = await api.deployments.list({
          ...(status !== 'all' ? { status } : {}),
          take: 50,
        });
        setDeployments(list);
        setTotal(t);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch deployments');
      }
    },
    [filter]
  );

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

  function applyFilter(s: StatusFilter) {
    setFilter(s);
    load(s);
  }

  const visible = search.trim()
    ? deployments.filter(
        (d) =>
          d.name.toLowerCase().includes(search.toLowerCase()) ||
          d.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
          d.publicUrl?.toLowerCase().includes(search.toLowerCase()) ||
          d.customSubdomain?.toLowerCase().includes(search.toLowerCase())
      )
    : deployments;

  const runningCount = deployments.filter((d) => d.status === 'running').length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: 110 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Deployments Fleet</Text>
          <Text style={styles.subtitle}>
            {runningCount} active containers / {total} total tracked
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{total}</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={15} color={colors.muted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search containers, domains, owners..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={colors.muted} style={{ paddingHorizontal: 4 }} />
          </Pressable>
        )}
      </View>

      {/* Status Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        {STATUSES.map((s) => {
          const isActive = filter === s;
          const count = s === 'all' ? deployments.length : deployments.filter((d) => d.status === s).length;
          return (
            <Pressable
              key={s}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => applyFilter(s)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {s.charAt(0).toUpperCase() + s.slice(1)} ({count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error && (
        <GlassCard style={{ marginBottom: 16, borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="alert-circle" size={15} color={colors.error} />
            <Text style={{ color: colors.error, fontFamily: fontFamily.bodyMedium, flex: 1 }}>{error}</Text>
          </View>
        </GlassCard>
      )}

      {visible.length === 0 && !error && (
        <GlassCard style={{ padding: 24, alignItems: 'center' }}>
          <Ionicons name="rocket-outline" size={32} color={colors.muted} style={{ marginBottom: 8 }} />
          <Text style={[styles.muted, { textAlign: 'center', marginBottom: 4 }]}>
            No deployments found matching this criteria.
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }}>
            Pull down to refresh or try another status filter.
          </Text>
        </GlassCard>
      )}

      {visible.map((dep) => (
        <Pressable
          key={dep.id}
          onPress={() => navigation.navigate('DeploymentDetail', { deploymentId: dep.id, name: dep.name })}
        >
          <GlassCard style={styles.depCard}>
            <View style={styles.depRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.depName} numberOfLines={1}>
                  {dep.name}
                </Text>
                <View style={styles.depUserRow}>
                  <Ionicons name="person-outline" size={11} color={colors.muted} />
                  <Text style={styles.depUser} numberOfLines={1}>
                    {dep.user?.displayName ? `${dep.user.displayName} (${dep.user.email})` : (dep.user?.email ?? 'Unknown Owner')}
                  </Text>
                </View>
              </View>
              <StatusBadge status={dep.status} />
            </View>

            <View style={styles.depMeta}>
              <View style={styles.metaChip}>
                <Ionicons name="server-outline" size={11} color={colors.primary} />
                <Text style={styles.metaChipText}>{dep.node?.label ?? 'Auto Node'}</Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="cube-outline" size={11} color={colors.cyan} />
                <Text style={styles.metaChipText}>{dep.image}:{dep.tag}</Text>
              </View>
              {dep.port ? (
                <View style={styles.metaChip}>
                  <Ionicons name="hardware-chip-outline" size={11} color={colors.warning} />
                  <Text style={styles.metaChipText}>:{dep.port}</Text>
                </View>
              ) : null}
            </View>

            {dep.publicUrl ? (
              <View style={styles.urlRow}>
                <Ionicons name="globe-outline" size={12} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={styles.urlText} numberOfLines={1}>
                  {dep.publicUrl}
                </Text>
                <Pressable
                  style={styles.openUrlBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    if (dep.publicUrl) Linking.openURL(dep.publicUrl);
                  }}
                >
                  <Text style={styles.openUrlBtnText}>Launch</Text>
                  <Ionicons name="open-outline" size={10} color="#fff" style={{ marginLeft: 3 }} />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.cardFooter}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="time-outline" size={11} color={colors.muted} />
                <Text style={styles.depDate}>
                  Updated {new Date(dep.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Text style={styles.detailLink}>Manage Container</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.primary} />
              </View>
            </View>
          </GlassCard>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontFamily: fontFamily.head, fontSize: 22, color: colors.onSurface },
  subtitle: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  countBadge: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
  },
  countText: { fontFamily: fontFamily.headSemibold, fontSize: 13, color: colors.primary },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  searchIcon: { fontSize: 13, marginRight: 8 },
  searchInput: {
    flex: 1,
    height: 44,
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: colors.onSurface,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipActive: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  chipText: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.muted },
  chipTextActive: { color: colors.primary },
  muted: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 13 },
  depCard: { marginBottom: 12, padding: 14 },
  depRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  depName: { fontFamily: fontFamily.headSemibold, fontSize: 15, color: colors.onSurface },
  depUserRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  depUser: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted },
  depMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  metaChipText: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(99,102,241,0.08)',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.2)',
  },
  urlText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    color: colors.primary,
    flex: 1,
    marginRight: 8,
  },
  openUrlBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  openUrlBtnText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 10,
    color: '#fff',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  depDate: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted },
  detailLink: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: colors.primary },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
    marginLeft: 6,
    flexShrink: 0,
  },
  badgeText: { fontFamily: fontFamily.headSemibold, fontSize: 10, letterSpacing: 0.5 },
});
