import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  TextInput,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/GlassCard';
import { api, Deployment } from '@/lib/api';
import { colors, fontFamily, spacing, statusStyle } from '@/theme/tokens';
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
      <Text style={[styles.badgeText, { color: s.text }]}>{status}</Text>
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
        setError(err.message);
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
          d.publicUrl?.toLowerCase().includes(search.toLowerCase())
      )
    : deployments;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Deployments</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{total}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, user, URL…"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Status filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        {STATUSES.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, filter === s && styles.chipActive]}
            onPress={() => applyFilter(s)}
          >
            <Text style={[styles.chipText, filter === s && styles.chipTextActive]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {error && (
        <GlassCard style={{ marginBottom: 16, borderColor: 'rgba(239,68,68,0.4)' }}>
          <Text style={{ color: colors.error, fontFamily: fontFamily.bodyMedium }}>{error}</Text>
        </GlassCard>
      )}

      {visible.length === 0 && !error && (
        <GlassCard>
          <Text style={styles.muted}>No deployments match this filter.</Text>
        </GlassCard>
      )}

      {visible.map((dep) => (
        <Pressable
          key={dep.id}
          onPress={() => navigation.navigate('DeploymentDetail', { deploymentId: dep.id, name: dep.name })}
        >
          <GlassCard style={styles.depCard}>
            <View style={styles.depRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.depName} numberOfLines={1}>
                  {dep.name}
                </Text>
                <Text style={styles.depUser} numberOfLines={1}>
                  {dep.user?.email ?? 'unknown'}
                </Text>
              </View>
              <StatusBadge status={dep.status} />
            </View>

            <View style={styles.depMeta}>
              <Text style={styles.metaChip}>
                Node: {dep.node?.label ?? 'No node'}
              </Text>
              {dep.publicUrl ? (
                <Text style={styles.metaChip} numberOfLines={1}>
                  {dep.publicUrl.replace(/^https?:\/\//, '')}
                </Text>
              ) : dep.customSubdomain ? (
                <Text style={styles.metaChip}>Subdomain: {dep.customSubdomain}</Text>
              ) : null}
              <Text style={styles.metaChip}>
                Image: {dep.image}:{dep.tag}
              </Text>
            </View>

            <Text style={styles.depDate}>
              Updated {new Date(dep.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </GlassCard>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: spacing.sm },
  title: { fontFamily: fontFamily.head, fontSize: 22, color: colors.onSurface },
  countBadge: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
  },
  countText: { fontFamily: fontFamily.headSemibold, fontSize: 12, color: colors.primary },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: {
    flex: 1,
    height: 40,
    fontFamily: fontFamily.body,
    fontSize: 14,
    color: colors.onSurface,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginRight: 8,
    backgroundColor: colors.glass,
  },
  chipActive: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  chipText: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.muted },
  chipTextActive: { color: colors.primary },
  muted: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 13 },
  depCard: { marginBottom: 12 },
  depRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  depName: { fontFamily: fontFamily.headSemibold, fontSize: 15, color: colors.onSurface, flex: 1 },
  depUser: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  depMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  metaChip: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  depDate: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
    marginLeft: 8,
    flexShrink: 0,
  },
  badgeText: { fontFamily: fontFamily.bodyMedium, fontSize: 11 },
});
