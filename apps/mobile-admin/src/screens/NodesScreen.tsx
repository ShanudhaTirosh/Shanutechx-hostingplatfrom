import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { api, Node } from '@/lib/api';
import { colors, fontFamily, radius, statusStyle } from '@/theme/tokens';

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

function NodeCard({
  node,
  onToggleActive,
  onOpenNodeEngine,
}: {
  node: Node;
  onToggleActive: (node: Node) => void;
  onOpenNodeEngine: (node: Node) => void;
}) {
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

      {/* Footer meta & Staff Actions */}
      <View style={styles.footerMeta}>
        <Text style={styles.metaText}>{node.deploymentCount} deployment{node.deploymentCount !== 1 ? 's' : ''}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => onOpenNodeEngine(node)} style={styles.cockpitBtn}>
            <Text style={styles.cockpitBtnText}>Node Engine</Text>
          </Pressable>
          <Pressable onPress={() => onToggleActive(node)} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>{node.status === 'online' ? 'Pause' : 'Activate'}</Text>
          </Pressable>
        </View>
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

  // Node Engine Modal
  const [engineNode, setEngineNode] = useState<Node | null>(null);
  const [engineData, setEngineData] = useState<any>(null);
  const [engineLoading, setEngineLoading] = useState(false);

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

  async function handleOpenNodeEngine(node: Node) {
    setEngineNode(node);
    setEngineLoading(true);
    setEngineData(null);
    try {
      const res = await api.nodes.engineMonitoring(node.id);
      setEngineData(res);
    } catch (err: any) {
      setEngineData({ error: err.message || 'Node Engine telemetry unavailable' });
    } finally {
      setEngineLoading(false);
    }
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
        <NodeCard
          key={node.id}
          node={node}
          onToggleActive={handleToggleActive}
          onOpenNodeEngine={handleOpenNodeEngine}
        />
      ))}

      {/* Node Engine Modal */}
      <Modal visible={!!engineNode} transparent animationType="slide" onRequestClose={() => setEngineNode(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.modalTitle}>Node Engine Telemetry</Text>
              <Pressable onPress={() => setEngineNode(null)}>
                <Text style={{ color: colors.muted, fontSize: 16 }}>X</Text>
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>{engineNode?.label} ({engineNode?.ip})</Text>

            {engineLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
            ) : engineData?.error ? (
              <Text style={{ color: colors.error, fontFamily: fontFamily.body, marginVertical: 14 }}>{engineData.error}</Text>
            ) : (
              <ScrollView style={{ maxHeight: 300, marginVertical: 10 }}>
                <Text style={styles.telemetryJson}>{JSON.stringify(engineData, null, 2)}</Text>
              </ScrollView>
            )}

            <Button label="Close" variant="glass" size="sm" onPress={() => setEngineNode(null)} style={{ marginTop: 12 }} />
          </View>
        </View>
      </Modal>
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
  actionBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(207,188,255,0.15)', borderWidth: 1, borderColor: 'rgba(207,188,255,0.25)' },
  actionBtnText: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: colors.primary },
  cockpitBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(6,182,212,0.15)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.3)' },
  cockpitBtnText: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: colors.cyan },
  muted: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.bgScreen2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, padding: 20 },
  modalTitle: { fontFamily: fontFamily.headSemibold, fontSize: 16, color: colors.onSurface },
  modalSubtitle: { fontFamily: 'monospace', fontSize: 12, color: colors.muted },
  telemetryJson: { fontFamily: 'monospace', fontSize: 11, color: colors.onSurfaceVariant, backgroundColor: 'rgba(0,0,0,0.4)', padding: 12, borderRadius: radius.sm },
});
