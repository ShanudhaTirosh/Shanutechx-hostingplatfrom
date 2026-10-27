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
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { api, Node } from '@/lib/api';
import { colors, fontFamily, radius, statusStyle } from '@/theme/tokens';

function formatUptime(seconds?: number): string {
  if (!seconds || isNaN(seconds)) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function UsageBar({ pct, color }: { pct: number | null; color: string }) {
  const val = typeof pct === 'number' && !isNaN(pct) ? pct : 0;
  return (
    <View style={styles.barTrack}>
      <View
        style={[
          styles.barFill,
          {
            width: `${Math.min(100, Math.max(0, val))}%` as any,
            backgroundColor: val > 85 ? colors.error : val > 65 ? colors.warning : color,
          },
        ]}
      />
    </View>
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
        {pct !== null ? `${pct.toFixed(0)}%` : '0%'}{suffix ? ' ' + suffix : ''}
      </Text>
    </View>
  );
}

function NodeCard({
  node,
  onToggleActive,
  onOpenNodeEngine,
  onFailover,
}: {
  node: Node;
  onToggleActive: (node: Node) => void;
  onOpenNodeEngine: (node: Node) => void;
  onFailover: (node: Node) => void;
}) {
  const s = statusStyle(node.status);
  const autoDomain = `node-${node.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}.shanutechx.com`;

  return (
    <GlassCard style={styles.nodeCard}>
      {/* Title row */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.nodeLabel}>{node.label}</Text>
            {node.isGlobal ? (
              <View style={styles.globalBadge}>
                <Text style={styles.globalBadgeText}>GLOBAL</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.nodeIp}>{node.ip}{node.region ? ` · ${node.region}` : ''}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Ionicons name="link-outline" size={11} color={colors.primary} />
            <Text style={styles.autoDomainText}>{autoDomain}</Text>
          </View>
        </View>
        <View style={[styles.badge, { backgroundColor: s.bg }]}>
          <View style={[styles.dot, { backgroundColor: s.dot }]} />
          <Text style={[styles.badgeText, { color: s.text }]}>{node.status.toUpperCase()}</Text>
        </View>
      </View>

      {/* Resource gauges */}
      <View style={styles.gauges}>
        <GaugeRow label="CPU" pct={node.cpuUsedPct} color={colors.primary} />
        <GaugeRow
          label="RAM"
          pct={node.ramUsedPct}
          color={colors.cyan}
          suffix={node.totalRamGb ? `${((node.ramUsedPct ?? 0) * node.totalRamGb / 100).toFixed(1)} / ${node.totalRamGb} GB` : undefined}
        />
        <GaugeRow
          label="Disk"
          pct={node.diskUsedPct}
          color={colors.success}
          suffix={node.totalDiskGb ? `${((node.diskUsedPct ?? 0) * node.totalDiskGb / 100).toFixed(1)} / ${node.totalDiskGb} GB` : undefined}
        />
      </View>

      {/* Footer meta & Staff Actions */}
      <View style={styles.footerMeta}>
        <View style={[styles.depPill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
          <Ionicons name="cube-outline" size={11} color={colors.cyan} />
          <Text style={styles.depPillText}>
            {node.deploymentCount} deployment{node.deploymentCount !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {node.status !== 'online' && (
            <Pressable onPress={() => onFailover(node)} style={[styles.actionBtn, { borderColor: 'rgba(245,158,11,0.5)', backgroundColor: 'rgba(245,158,11,0.08)' }]}>
              <Text style={[styles.actionBtnText, { color: colors.warning }]}>Failover</Text>
            </Pressable>
          )}
          <Pressable onPress={() => onOpenNodeEngine(node)} style={[styles.nodeEngineBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
            <Ionicons name="flash-outline" size={11} color={colors.cyan} />
            <Text style={styles.nodeEngineBtnText}>Node Engine</Text>
          </Pressable>
          <Pressable onPress={() => onToggleActive(node)} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>{node.isActive ? 'Pause' : 'Activate'}</Text>
          </Pressable>
        </View>
      </View>
    </GlassCard>
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
      setError(err.message || 'Failed to fetch cluster nodes');
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

  async function fetchEngineTelemetry(node: Node) {
    setEngineLoading(true);
    setEngineData(null);
    try {
      const res = await api.nodes.engineMonitoring(node.id);
      setEngineData(res);
    } catch (err: any) {
      setEngineData({ error: err.message || 'Node Engine telemetry agent unreachable' });
    } finally {
      setEngineLoading(false);
    }
  }

  async function handleOpenNodeEngine(node: Node) {
    setEngineNode(node);
    fetchEngineTelemetry(node);
  }

  async function handleToggleActive(target: Node) {
    const nextActive = !target.isActive;
    Alert.alert(
      `${nextActive ? 'Activate' : 'Pause'} Node`,
      `Are you sure you want to set node "${target.label}" to ${nextActive ? 'Active' : 'Paused'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await api.nodes.toggleActive(target.id, nextActive);
              load();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to update node status');
            }
          },
        },
      ]
    );
  }

  async function handleFailover(target: Node) {
    Alert.alert(
      'Evacuate Workloads (Failover)',
      `Failover will safely migrate all container deployments and databases away from node "${target.label}" to healthy nodes. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Initiate Failover',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await api.nodes.failover(target.id);
              Alert.alert('Failover Initiated', res.message || 'Evacuation started in background.');
              load();
            } catch (err: any) {
              Alert.alert('Failover Error', err.message || 'Failed to initiate failover');
            }
          },
        },
      ]
    );
  }

  const online = nodes.filter((n) => n.status === 'online').length;
  const degraded = nodes.filter((n) => n.status === 'degraded').length;
  const offline = nodes.filter((n) => n.status === 'offline').length;

  const totalRamGb = nodes.reduce((sum, n) => sum + (n.totalRamGb || 0), 0);
  const totalDiskGb = nodes.reduce((sum, n) => sum + (n.totalDiskGb || 0), 0);
  const totalDeployments = nodes.reduce((sum, n) => sum + (n.deploymentCount || 0), 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: 110 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Compute Cluster Fleet</Text>
          <Text style={styles.subtitle}>
            {nodes.length} host nodes registered · {totalDeployments} running apps
          </Text>
        </View>
      </View>

      {/* Cluster Overview Card */}
      {nodes.length > 0 && (
        <GlassCard style={styles.fleetSummaryCard}>
          <Text style={styles.fleetSummaryTitle}>Fleet Resource Pool</Text>
          <View style={styles.fleetSummaryGrid}>
            <View style={styles.fleetSummaryItem}>
              <Text style={styles.fleetSummaryValue}>{totalRamGb.toFixed(0)} GB</Text>
              <Text style={styles.fleetSummaryLabel}>Total Fleet RAM</Text>
            </View>
            <View style={styles.fleetSummaryItem}>
              <Text style={styles.fleetSummaryValue}>{totalDiskGb.toFixed(0)} GB</Text>
              <Text style={styles.fleetSummaryLabel}>Total SSD Disk</Text>
            </View>
            <View style={styles.fleetSummaryItem}>
              <Text style={[styles.fleetSummaryValue, { color: colors.success }]}>{online}/{nodes.length}</Text>
              <Text style={styles.fleetSummaryLabel}>Nodes Online</Text>
            </View>
          </View>
        </GlassCard>
      )}

      {/* Summary status chips */}
      <View style={styles.summaryRow}>
        <SummaryChip label="Online" count={online} color={colors.success} />
        <SummaryChip label="Degraded" count={degraded} color={colors.warning} />
        <SummaryChip label="Offline" count={offline} color={colors.error} />
        <SummaryChip label="Total Nodes" count={nodes.length} color={colors.primary} />
      </View>

      {error && (
        <GlassCard style={{ marginBottom: 16, borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="alert-circle" size={15} color={colors.error} />
            <Text style={{ color: colors.error, fontFamily: fontFamily.bodyMedium, flex: 1 }}>{error}</Text>
          </View>
        </GlassCard>
      )}

      {nodes.length === 0 && !error && (
        <GlassCard style={{ padding: 24, alignItems: 'center' }}>
          <Ionicons name="server-outline" size={32} color={colors.muted} style={{ marginBottom: 8 }} />
          <Text style={[styles.muted, { textAlign: 'center', marginBottom: 4 }]}>
            No compute host nodes registered yet.
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }}>
            Register a VPS host node from the web console to begin container orchestration.
          </Text>
        </GlassCard>
      )}

      {nodes.map((node) => (
        <NodeCard
          key={node.id}
          node={node}
          onToggleActive={handleToggleActive}
          onOpenNodeEngine={handleOpenNodeEngine}
          onFailover={handleFailover}
        />
      ))}

      {/* Node Engine Telemetry Modal */}
      <Modal visible={!!engineNode} transparent animationType="slide" onRequestClose={() => setEngineNode(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="flash" size={15} color={colors.primary} />
                  <Text style={styles.modalTitle}>Node Engine Telemetry</Text>
                </View>
                <Text style={styles.modalSubtitle}>{engineNode?.label} ({engineNode?.ip})</Text>
              </View>
              <Pressable onPress={() => setEngineNode(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={colors.onSurface} />
              </Pressable>
            </View>

            {engineLoading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator color={colors.cyan} size="large" />
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 12 }}>
                  Querying live Docker & kernel telemetry...
                </Text>
              </View>
            ) : engineData?.error ? (
              <View style={{ padding: 16, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: radius.sm, marginVertical: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="alert-circle" size={14} color={colors.error} />
                  <Text style={{ color: colors.error, fontFamily: fontFamily.bodyMedium, flex: 1 }}>{engineData.error}</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>
                  Ensure @shanutechx/node-agent daemon is running on port 3004 of host {engineNode?.ip}.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 340, marginVertical: 12 }}>
                <View style={styles.telemetryCard}>
                  <TelemetryRow
                    label="Docker Engine"
                    value={engineData?.docker?.status || engineData?.dockerStatus || (engineData?.cpu ? 'ONLINE' : '—')}
                    highlight={engineData?.docker?.status === 'online' || !!engineData?.cpu}
                  />
                  {engineData?.docker?.containersRunning !== undefined || engineData?.containersRunning !== undefined ? (
                    <TelemetryRow
                      label="Containers Running"
                      value={String(engineData?.docker?.containersRunning ?? engineData?.containersRunning ?? engineData?.containers?.running ?? '0')}
                    />
                  ) : null}
                  <TelemetryRow
                    label="CPU Load"
                    value={
                      engineData?.cpu?.usagePct !== undefined
                        ? `${engineData.cpu.usagePct}% (${engineData.cpu.cores || 1} cores)`
                        : engineData?.system?.cpuPct
                        ? `${engineData.system.cpuPct}%`
                        : '—'
                    }
                  />
                  {engineData?.cpu?.brand ? (
                    <TelemetryRow
                      label="Processor"
                      value={engineData.cpu.brand}
                    />
                  ) : null}
                  <TelemetryRow
                    label="RAM Memory"
                    value={
                      engineData?.memory?.usedMb !== undefined
                        ? `${(engineData.memory.usedMb / 1024).toFixed(1)} GB / ${(engineData.memory.totalMb / 1024).toFixed(1)} GB (${engineData.memory.usedPct}%)`
                        : engineData?.system?.ramUsedGb
                        ? `${engineData.system.ramUsedGb} GB / ${engineData.system.ramTotalGb} GB`
                        : '—'
                    }
                  />
                  <TelemetryRow
                    label="Disk Storage"
                    value={
                      Array.isArray(engineData?.disks) && engineData.disks.length > 0
                        ? `${engineData.disks[0].usedGb} GB / ${engineData.disks[0].sizeGb} GB (${engineData.disks[0].usedPct}%)`
                        : engineData?.system?.diskUsedGb
                        ? `${engineData.system.diskUsedGb} GB / ${engineData.system.diskTotalGb} GB`
                        : '—'
                    }
                  />
                  {engineData?.network ? (
                    <TelemetryRow
                      label="Monthly Bandwidth"
                      value={`${engineData.network.usedGb || 0} GB / ${engineData.network.monthlyLimitGb || 30000} GB (${engineData.network.usedPct || 0}%)`}
                    />
                  ) : null}
                  <TelemetryRow
                    label="Agent Version"
                    value={engineData?.agentVersion || 'v1.4.0'}
                    mono
                  />
                  <TelemetryRow
                    label="System Uptime"
                    value={
                      engineData?.uptimeSeconds !== undefined
                        ? formatUptime(engineData.uptimeSeconds)
                        : engineData?.uptime || engineData?.system?.uptime || 'Active'
                    }
                    mono
                  />
                </View>
              </ScrollView>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Button
                label="Refresh"
                icon={<Ionicons name="sync-outline" size={14} color={colors.onSurface} />}
                variant="glass"
                size="sm"
                onPress={() => engineNode && fetchEngineTelemetry(engineNode)}
                disabled={engineLoading}
                style={{ flex: 1 }}
              />
              <Button
                label="Close"
                variant="primary"
                size="sm"
                onPress={() => setEngineNode(null)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function TelemetryRow({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <View style={styles.telemetryRow}>
      <Text style={styles.telemetryLabel}>{label}</Text>
      <Text style={[styles.telemetryValue, highlight && { color: colors.success }, mono && { fontFamily: 'monospace' }]}>
        {value}
      </Text>
    </View>
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
  header: { marginBottom: 16 },
  title: { fontFamily: fontFamily.head, fontSize: 22, color: colors.onSurface },
  subtitle: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  fleetSummaryCard: { marginBottom: 14, padding: 14 },
  fleetSummaryTitle: { fontFamily: fontFamily.headSemibold, fontSize: 13, color: colors.onSurface, marginBottom: 10 },
  fleetSummaryGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  fleetSummaryItem: { alignItems: 'center', flex: 1 },
  fleetSummaryValue: { fontFamily: fontFamily.headExtrabold, fontSize: 18, color: colors.onSurface },
  fleetSummaryLabel: { fontFamily: fontFamily.body, fontSize: 10, color: colors.muted, marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  summaryCount: { fontFamily: fontFamily.headExtrabold, fontSize: 18 },
  summaryLabel: { fontFamily: fontFamily.body, fontSize: 10, color: colors.muted, marginTop: 2 },
  nodeCard: { marginBottom: 12, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  nodeLabel: { fontFamily: fontFamily.headSemibold, fontSize: 15, color: colors.onSurface },
  globalBadge: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
  },
  globalBadgeText: { fontFamily: fontFamily.headSemibold, fontSize: 9, color: colors.primary },
  nodeIp: { fontFamily: 'monospace', fontSize: 11, color: colors.muted, marginTop: 2 },
  autoDomainText: { fontFamily: 'monospace', fontSize: 10, color: colors.primary, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
    flexShrink: 0,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  badgeText: { fontFamily: fontFamily.headSemibold, fontSize: 10, letterSpacing: 0.5 },
  gauges: { gap: 8, marginBottom: 12 },
  gaugeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gaugeLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: colors.muted, width: 32 },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  gaugePct: { fontFamily: 'monospace', fontSize: 10, color: colors.onSurfaceVariant, width: 90, textAlign: 'right' },
  footerMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  depPill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  depPillText: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: colors.onSurfaceVariant },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(207,188,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(207,188,255,0.25)',
  },
  actionBtnText: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: colors.primary },
  nodeEngineBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(6,182,212,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.3)',
  },
  nodeEngineBtnText: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: colors.cyan },
  muted: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.bgScreen2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, padding: 20 },
  modalTitle: { fontFamily: fontFamily.headSemibold, fontSize: 16, color: colors.onSurface },
  modalSubtitle: { fontFamily: 'monospace', fontSize: 12, color: colors.muted, marginTop: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  telemetryCard: { backgroundColor: 'rgba(0,0,0,0.4)', padding: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder },
  telemetryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  telemetryLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.muted },
  telemetryValue: { fontFamily: fontFamily.bodySemibold, fontSize: 12, color: colors.onSurface },
});
