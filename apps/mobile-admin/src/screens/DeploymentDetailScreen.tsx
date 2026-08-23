import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { api, Deployment, DeploymentLog } from '@/lib/api';
import { colors, fontFamily, spacing, statusStyle } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

type Route = RouteProp<RootStackParamList, 'DeploymentDetail'>;

const LOG_COLORS: Record<string, string> = {
  info: colors.onSurfaceVariant,
  warn: colors.warning,
  error: colors.error,
};

export function DeploymentDetailScreen() {
  const { params } = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [logsText, setLogsText] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<'restart' | 'stop' | null>(null);
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

  const s = deployment ? statusStyle(deployment.status) : null;

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
            {deployment.customSubdomain && (
              <InfoRow label="Subdomain" value={deployment.customSubdomain} mono />
            )}
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
          <Text style={styles.sectionTitle}>Recent Logs</Text>
          <GlassCard style={{ padding: 14 }}>
            {!logsText ? (
              <Text style={styles.muted}>No recent log entries.</Text>
            ) : (
              <Text style={styles.logText}>{logsText}</Text>
            )}
          </GlassCard>
        </>
      )}
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
  muted: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 13 },
});
