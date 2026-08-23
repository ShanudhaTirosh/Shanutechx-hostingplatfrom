import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/GlassCard';
import { api, Node } from '@/lib/api';
import { colors, fontFamily, spacing, statusStyle } from '@/theme/tokens';

function UsageBar({ pct, color }: { pct: number | null; color: string }) {
  const val = pct ?? 0;
  return (
    <View style={styles.barTrack}>
      <View
        style={[
          styles.barFill,
          {
            width: `${Math.min(100, val)}%` as any,
            backgroundColor: val > 85 ? colors.error : val > 60 ? colors.warning : color,
          },
        ]}
      />
    </View>
  );
}

function NodeCard({ node, onToggleActive }: { node: Node; onToggleActive: (node: Node) => void }) {
  const s = statusStyle(node.status);
  return (
    <GlassCard style={styles.nodeCard}>
      {/* Title row */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.nodeLabel}>{node.label}</Text>
          <Text style={styles.nodeIp}>{node.ip}{node.region ? ` · ${node.region}` : ''}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: s.bg }]}>
          <View style={[styles.dot, { backgroundColor: s.dot }]} />
          <Text style={[styles.badgeText, { color: s.text }]}>{node.status}</Text>
        </View>
      </View>

      {/* Resource gauges */}
      <View style={styles.gauges}>
        <GaugeRow label="CPU" pct={node.cpuUsedPct} color={colors.primary} />
        <GaugeRow label="RAM" pct={node.ramUsedPct} color={colors.cyan} suffix={node.totalRamGb ? `/ ${node.totalRamGb} GB` : undefined} />
        <GaugeRow label="Disk" pct={node.diskUsedPct} color={colors.success} suffix={node.totalDiskGb ? `/ ${node.totalDiskGb} GB` : undefined} />
      </View>

      {/* Footer meta & Staff Action */}
      <View style={styles.footerMeta}>
        <Text style={styles.metaText}>🚀 {node.deploymentCount} deployment{node.deploymentCount !== 1 ? 's' : ''}</Text>
        <Pressable onPress={() => onToggleActive(node)} style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>{node.status === 'online' ? 'Pause Node' : 'Activate Node'}</Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

function GaugeRow({
  label,
  pct,
  color,
  suffix,
}: {
  label: string;
  pct: number | null;
  color: string;
  suffix?: string;
}) {
  return (
    <View style={styles.gaugeRow}>
      <Text style={styles.gaugeLabel}>{label}</Text>
      <UsageBar pct={pct} color={color} />
      <Text style={styles.gaugePct}>
        {pct !== null ? `${pct.toFixed(0)}%` : '—'}{suffix ? ' ' + suffix : ''}
      </Text>
    </View>
  );
}

export function NodesScreen() {
  const insets = useSafeAreaInsets();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { nodes: list } = await api.nodes.list();
      setNodes(list);
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

  async function handleToggleActive(target: Node) {
    const nextStatus = target.status === 'online' ? false : true;
    Alert.alert(
      `${nextStatus ? 'Activate' : 'Pause'} Node`,
      `Are you sure you want to set node "${target.label}" to ${nextStatus ? 'Active' : 'Paused'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await api.nodes.toggleActive(target.id, nextStatus);
              load();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to update node status');
            }
          },
        },
      ]
    );
  }

  const online = nodes.filter((n) => n.status === 'online').length;
  const degraded = nodes.filter((n) => n.status === 'degraded').length;
  const offline = nodes.filter((n) => n.status === 'offline').length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Nodes</Text>

      {/* Summary chips */}
      <View style={styles.summaryRow}>
        <SummaryChip label="Online" count={online} color={colors.success} />
        <SummaryChip label="Degraded" count={degraded} color={colors.warning} />
        <SummaryChip label="Offline" count={offline} color={colors.error} />
        <SummaryChip label="Total" count={nodes.length} color={colors.primary} />
      </View>

      {error && (
        <GlassCard style={{ marginBottom: 16, borderColor: 'rgba(239,68,68,0.4)' }}>
          <Text style={{ color: colors.error, fontFamily: fontFamily.bodyMedium }}>{error}</Text>
        </GlassCard>
      )}

      {nodes.length === 0 && !error && (
        <GlassCard>
          <Text style={styles.muted}>No nodes registered yet.</Text>
        </GlassCard>
      )}

      {nodes.map((node) => (
        <NodeCard key={node.id} node={node} onToggleActive={handleToggleActive} />
      ))}
    </ScrollView>
  );
}

function SummaryChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={[styles.summaryChip, { borderColor: color + '44' }]}>
      <Text style={[styles.summaryCount, { color }]}>{count}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  title: { fontFamily: fontFamily.head, fontSize: 22, color: colors.onSurface, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  summaryChip: {
    flex: 1,
    minWidth: 70,
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: colors.glass,
    paddingVertical: 10,
    alignItems: 'center',
  },
  summaryCount: { fontFamily: fontFamily.headExtrabold, fontSize: 20 },
  summaryLabel: { fontFamily: fontFamily.body, fontSize: 10, color: colors.muted, marginTop: 2 },
  nodeCard: { marginBottom: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  nodeLabel: { fontFamily: fontFamily.headSemibold, fontSize: 15, color: colors.onSurface },
  nodeIp: { fontFamily: 'monospace', fontSize: 12, color: colors.muted, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    marginLeft: 10,
    flexShrink: 0,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  badgeText: { fontFamily: fontFamily.bodyMedium, fontSize: 11 },
  gauges: { gap: 10, marginBottom: 14 },
  gaugeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gaugeLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.muted, width: 32 },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  gaugePct: { fontFamily: 'monospace', fontSize: 11, color: colors.onSurfaceVariant, width: 70, textAlign: 'right' },
  footerMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(207,188,255,0.15)', borderWidth: 1, borderColor: 'rgba(207,188,255,0.25)' },
  actionBtnText: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: colors.primary },
  muted: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 13 },
});
