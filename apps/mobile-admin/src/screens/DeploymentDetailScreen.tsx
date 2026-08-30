import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Pressable,
} from 'react-native';
import { useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { api, Deployment, DeploymentLog } from '@/lib/api';
import { colors, fontFamily, radius, spacing, statusStyle } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

type Route = RouteProp<RootStackParamList, 'DeploymentDetail'>;

export function DeploymentDetailScreen() {
  const { params } = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [logsText, setLogsText] = useState<string>('');
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<'restart' | 'stop' | null>(null);
  const [subdomainModalVisible, setSubdomainModalVisible] = useState(false);
  const [newSubdomain, setNewSubdomain] = useState('');
  const [subdomainSaving, setSubdomainSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [{ deployment: dep }, { logs: logData }] = await Promise.all([
        api.deployments.get(params.deploymentId),
        api.deployments.logs(params.deploymentId, 50),
      ]);
      setDeployment(dep);
      if (typeof logData === 'string') {
        setLogsText(logData);
      } else if (Array.isArray(logData)) {
        setLogsText(logData.map((l) => `[${l.level.toUpperCase()}] ${l.message}`).join('\n'));
      } else {
        setLogsText('');
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, [params.deploymentId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleRestart() {
    Alert.alert('Restart Deployment', 'Restart this deployment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restart',
        onPress: async () => {
          setActionLoading('restart');
          try {
            const { deployment: dep } = await api.deployments.restart(params.deploymentId);
            setDeployment(dep);
          } catch (err: any) {
            Alert.alert('Error', err.message);
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  }

  async function handleStop() {
    Alert.alert('Stop Deployment', 'Stop this deployment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop',
        style: 'destructive',
        onPress: async () => {
          setActionLoading('stop');
          try {
            const { deployment: dep } = await api.deployments.stop(params.deploymentId);
            setDeployment(dep);
          } catch (err: any) {
            Alert.alert('Error', err.message);
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  }

  async function handleSaveSubdomain() {
    if (!newSubdomain.trim()) return;
    setSubdomainSaving(true);
    try {
      const { deployment: dep } = await api.deployments.updateSubdomain(params.deploymentId, newSubdomain.trim());
      setDeployment(dep);
      setSubdomainModalVisible(false);
      Alert.alert('Success', 'Subdomain updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update subdomain');
    } finally {
      setSubdomainSaving(false);
    }
  }

  const s = deployment ? statusStyle(deployment.status) : null;

  const filteredLogs = logsText
    ? logsText
        .split('\n')
        .filter((line) => {
          if (logFilter === 'all') return true;
          return line.toLowerCase().includes(`[${logFilter}]`);
        })
        .join('\n')
    : '';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.title} numberOfLines={2}>{params.name}</Text>
      <Text style={styles.id}>{params.deploymentId}</Text>

      {error && (
        <GlassCard style={{ marginBottom: 16, borderColor: 'rgba(239,68,68,0.4)' }}>
          <Text style={{ color: colors.error, fontFamily: fontFamily.bodyMedium }}>{error}</Text>
        </GlassCard>
      )}

      {deployment && (
        <>
          {/* Status + Actions */}
          <GlassCard style={{ marginBottom: 16 }}>
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, { backgroundColor: s!.bg }]}>
                <View style={[styles.dot, { backgroundColor: s!.dot }]} />
                <Text style={[styles.statusText, { color: s!.text }]}>{deployment.status}</Text>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Button
                  label={actionLoading === 'restart' ? 'Restarting…' : '↺ Restart'}
                  variant="outline"
                  onPress={handleRestart}
                  disabled={!!actionLoading || deployment.status === 'building'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={actionLoading === 'stop' ? 'Stopping…' : '■ Stop'}
                  variant="outlineDanger"
                  onPress={handleStop}
                  disabled={!!actionLoading || deployment.status === 'stopped' || deployment.status === 'terminated'}
                />
              </View>
            </View>
          </GlassCard>

          {/* Info */}
          <GlassCard style={{ marginBottom: 16 }}>
            <InfoRow label="Owner" value={deployment.user?.email ?? '—'} />
            <InfoRow label="Image" value={`${deployment.image}:${deployment.tag}`} mono />
            <InfoRow label="Node" value={deployment.node?.label ?? 'Unassigned'} />
            {deployment.publicUrl && <InfoRow label="URL" value={deployment.publicUrl} mono />}
            <Pressable
              onPress={() => {
                setNewSubdomain(deployment.customSubdomain ?? '');
                setSubdomainModalVisible(true);
              }}
            >
              <InfoRow
                label="Subdomain ✏️"
                value={deployment.customSubdomain ? `${deployment.customSubdomain}.shanutechx.com` : 'Set Subdomain…'}
                mono
              />
            </Pressable>
            <InfoRow
              label="Env Vars"
              value={deployment.envVars ? `${deployment.envVars.length} variable(s)` : '—'}
            />
            <InfoRow
              label="Created"
              value={new Date(deployment.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
            />
            <InfoRow
              label="Updated"
              value={new Date(deployment.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              last
            />
          </GlassCard>

          {/* Logs */}
          <View style={styles.logHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Logs</Text>
            <View style={styles.logFilterChips}>
              {(['all', 'info', 'warn', 'error'] as const).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setLogFilter(f)}
                  style={[styles.logChip, logFilter === f && styles.logChipActive]}
                >
                  <Text style={[styles.logChipText, logFilter === f && styles.logChipTextActive]}>
                    {f.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <GlassCard style={{ padding: 14 }}>
            {!filteredLogs ? (
              <Text style={styles.muted}>No logs matching filter "{logFilter.toUpperCase()}".</Text>
            ) : (
              <Text style={styles.logText}>{filteredLogs}</Text>
            )}
          </GlassCard>
        </>
      )}

      {/* Subdomain Edit Modal */}
      <Modal visible={subdomainModalVisible} transparent animationType="fade" onRequestClose={() => setSubdomainModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update Custom Subdomain</Text>
            <Text style={styles.modalSubtitle}>Configure custom subdomain under *.shanutechx.com</Text>
            <TextInput
              value={newSubdomain}
              onChangeText={setNewSubdomain}
              placeholder="my-app"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={styles.subdomainInput}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button label="Cancel" variant="glass" size="sm" onPress={() => setSubdomainModalVisible(false)} style={{ flex: 1 }} />
              <Button label="Save" variant="primary" size="sm" onPress={handleSaveSubdomain} loading={subdomainSaving} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && { fontFamily: 'monospace' }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  title: { fontFamily: fontFamily.head, fontSize: 20, color: colors.onSurface, marginBottom: 4 },
  id: { fontSize: 11, color: colors.muted, marginBottom: 20, fontFamily: 'monospace' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
  },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  statusText: { fontFamily: fontFamily.headSemibold, fontSize: 13 },
  actionsRow: { flexDirection: 'row' },
  sectionTitle: {
    fontFamily: fontFamily.headSemibold,
    fontSize: 14,
    color: colors.onSurface,
    marginBottom: 10,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
  infoLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 13, color: colors.muted },
  infoValue: { fontFamily: fontFamily.body, fontSize: 13, color: colors.onSurface, marginLeft: 12, flexShrink: 1, textAlign: 'right' },
  logsCard: { padding: 0 },
  logText: { fontFamily: 'monospace', fontSize: 11, color: colors.onSurfaceVariant, lineHeight: 16 },
  logRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  logLevel: { fontFamily: 'monospace', fontSize: 10, marginRight: 8, paddingTop: 1, flexShrink: 0, width: 38 },
  logMsg: { fontFamily: 'monospace', fontSize: 11, color: colors.onSurfaceVariant, flex: 1, lineHeight: 16 },
  logHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 10 },
  logFilterChips: { flexDirection: 'row', gap: 6 },
  logChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
  logChipActive: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  logChipText: { fontFamily: fontFamily.bodyMedium, fontSize: 10, color: colors.muted },
  logChipTextActive: { color: colors.primary },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.bgScreen2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, padding: 20 },
  modalTitle: { fontFamily: fontFamily.headSemibold, fontSize: 16, color: colors.onSurface },
  modalSubtitle: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: 14 },
  subdomainInput: {
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    color: colors.onSurface,
    fontFamily: fontFamily.body,
    fontSize: 14,
  },
  muted: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 13 },
});
