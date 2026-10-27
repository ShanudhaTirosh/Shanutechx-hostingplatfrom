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
  Linking,
} from 'react-native';
import { useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { api, Deployment } from '@/lib/api';
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
  const [actionLoading, setActionLoading] = useState<'restart' | 'stop' | 'start' | 'redeploy' | 'logs' | null>(null);
  const [subdomainModalVisible, setSubdomainModalVisible] = useState(false);
  const [newSubdomain, setNewSubdomain] = useState('');
  const [subdomainSaving, setSubdomainSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [{ deployment: dep }, { logs: logData }] = await Promise.all([
        api.deployments.get(params.deploymentId),
        api.deployments.logs(params.deploymentId, 80),
      ]);
      setDeployment(dep);
      if (typeof logData === 'string') {
        setLogsText(logData);
      } else if (Array.isArray(logData)) {
        setLogsText(logData.map((l) => `[${l.level?.toUpperCase() || 'INFO'}] ${l.message}`).join('\n'));
      } else {
        setLogsText('');
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch deployment details');
    }
  }, [params.deploymentId]);

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

  async function refreshOnlyLogs() {
    setActionLoading('logs');
    try {
      const { logs: logData } = await api.deployments.logs(params.deploymentId, 100);
      if (typeof logData === 'string') {
        setLogsText(logData);
      } else if (Array.isArray(logData)) {
        setLogsText(logData.map((l) => `[${l.level?.toUpperCase() || 'INFO'}] ${l.message}`).join('\n'));
      }
    } catch (err: any) {
      Alert.alert('Logs Error', err.message || 'Failed to refresh logs');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRestart() {
    Alert.alert('Restart Container', 'Are you sure you want to trigger a zero-downtime container restart?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restart Now',
        onPress: async () => {
          setActionLoading('restart');
          try {
            const { deployment: dep } = await api.deployments.restart(params.deploymentId);
            setDeployment(dep);
            Alert.alert('Container Restarted', 'The deployment rebuild & restart sequence has been initiated.');
          } catch (err: any) {
            Alert.alert('Restart Error', err.message || 'Failed to restart deployment');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  }

  async function handleStart() {
    setActionLoading('start');
    try {
      const { deployment: dep } = await api.deployments.start(params.deploymentId);
      setDeployment(dep);
      Alert.alert('Container Started', 'The container has been started successfully.');
    } catch (err: any) {
      Alert.alert('Start Error', err.message || 'Failed to start deployment');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRedeploy() {
    Alert.alert('Redeploy Container', 'Trigger a full rebuild and deployment from latest code?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Redeploy Now',
        onPress: async () => {
          setActionLoading('redeploy');
          try {
            const { deployment: dep } = await api.deployments.redeploy(params.deploymentId);
            setDeployment(dep);
            Alert.alert('Redeploy Started', 'Build and deployment pipeline is now executing.');
          } catch (err: any) {
            Alert.alert('Redeploy Error', err.message || 'Failed to trigger redeployment');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  }

  async function handleStop() {
    Alert.alert('Stop Container', 'Are you sure you want to shut down this container?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop Container',
        style: 'destructive',
        onPress: async () => {
          setActionLoading('stop');
          try {
            const { deployment: dep } = await api.deployments.stop(params.deploymentId);
            setDeployment(dep);
            Alert.alert('Container Stopped', 'The deployment has been stopped successfully.');
          } catch (err: any) {
            Alert.alert('Stop Error', err.message || 'Failed to stop deployment');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  }

  async function handleSaveSubdomain() {
    const cleanSubdomain = newSubdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!cleanSubdomain) {
      Alert.alert('Invalid Subdomain', 'Please enter a valid alphanumeric subdomain slug.');
      return;
    }
    setSubdomainSaving(true);
    try {
      const { deployment: dep } = await api.deployments.updateSubdomain(params.deploymentId, cleanSubdomain);
      setDeployment(dep);
      setSubdomainModalVisible(false);
      Alert.alert('Success', `Subdomain updated to ${cleanSubdomain}.shanutechx.com with auto-DNS!`);
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Failed to update custom subdomain');
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
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: 80 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.title} numberOfLines={2}>
            {params.name}
          </Text>
          <Text style={styles.id}>{params.deploymentId}</Text>
        </View>
        {s && deployment && (
          <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
            <View style={[styles.dot, { backgroundColor: s.dot }]} />
            <Text style={[styles.statusText, { color: s.text }]}>{deployment.status.toUpperCase()}</Text>
          </View>
        )}
      </View>

      {error && (
        <GlassCard style={{ marginBottom: 16, borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="alert-circle" size={15} color={colors.error} />
            <Text style={{ color: colors.error, fontFamily: fontFamily.bodyMedium, flex: 1 }}>{error}</Text>
          </View>
        </GlassCard>
      )}

      {deployment && (
        <>
          {/* Quick Actions Card */}
          <GlassCard style={{ marginBottom: 16, padding: 14 }}>
            <Text style={styles.sectionTitle}>Operations</Text>
            <View style={styles.actionsRow}>
              {deployment.status === 'stopped' ? (
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Button
                    label={actionLoading === 'start' ? 'Starting…' : 'Start Container'}
                    icon={<Ionicons name="play-circle-outline" size={15} color="#1a0f33" />}
                    variant="primary"
                    size="sm"
                    onPress={handleStart}
                    disabled={!!actionLoading}
                  />
                </View>
              ) : (
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Button
                    label={actionLoading === 'restart' ? 'Restarting…' : 'Restart'}
                    icon={<Ionicons name="sync-outline" size={15} color={colors.primary} />}
                    variant="outline"
                    size="sm"
                    onPress={handleRestart}
                    disabled={!!actionLoading || deployment.status === 'building'}
                  />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Button
                  label={actionLoading === 'stop' ? 'Stopping…' : 'Stop'}
                  icon={<Ionicons name="stop-circle-outline" size={15} color="#ff8a80" />}
                  variant="outlineDanger"
                  size="sm"
                  onPress={handleStop}
                  disabled={!!actionLoading || deployment.status === 'stopped' || deployment.status === 'terminated'}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label={actionLoading === 'redeploy' ? 'Redeploying…' : 'Redeploy'}
                  icon={<Ionicons name="git-branch-outline" size={15} color={colors.cyan} />}
                  variant="glass"
                  size="sm"
                  onPress={handleRedeploy}
                  disabled={!!actionLoading || deployment.status === 'building'}
                />
              </View>
              {deployment.publicUrl && (
                <View style={{ flex: 1 }}>
                  <Button
                    label="Open in Browser"
                    icon={<Ionicons name="open-outline" size={15} color="#1a0f33" />}
                    variant="primary"
                    size="sm"
                    onPress={() => {
                      if (deployment.publicUrl) Linking.openURL(deployment.publicUrl);
                    }}
                  />
                </View>
              )}
            </View>
          </GlassCard>

          {/* Container & Spec Info */}
          <GlassCard style={{ marginBottom: 16, padding: 14 }}>
            <Text style={styles.sectionTitle}>Specifications</Text>
            <InfoRow
              label="Owner"
              value={deployment.user?.displayName ? `${deployment.user.displayName} (${deployment.user.email})` : (deployment.user?.email ?? '—')}
            />
            <InfoRow label="Docker Image" value={`${deployment.image}:${deployment.tag}`} mono />
            <InfoRow label="Compute Node" value={deployment.node?.label ?? 'Auto Assigned'} />
            {deployment.cpuLimit || deployment.memoryLimit ? (
              <InfoRow
                label="Resource Allocation"
                value={`${deployment.cpuLimit ? `${deployment.cpuLimit} vCPU` : ''}${deployment.cpuLimit && deployment.memoryLimit ? ' · ' : ''}${deployment.memoryLimit ? `${deployment.memoryLimit} MB RAM` : ''}`}
                mono
              />
            ) : null}
            {deployment.exposureMode ? (
              <InfoRow label="Exposure Mode" value={deployment.exposureMode.toUpperCase()} />
            ) : null}
            {deployment.port ? <InfoRow label="Assigned Port" value={`:${deployment.port}`} mono /> : null}
            {deployment.publicUrl && (
              <Pressable onPress={() => Linking.openURL(deployment.publicUrl!)}>
                <InfoRow
                  label="Public URL"
                  value={deployment.publicUrl}
                  rightIcon={<Ionicons name="open-outline" size={13} color={colors.primary} />}
                  mono
                  highlight
                />
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                setNewSubdomain(deployment.customSubdomain ?? '');
                setSubdomainModalVisible(true);
              }}
            >
              <InfoRow
                label="Custom Subdomain"
                value={deployment.customSubdomain ? `${deployment.customSubdomain}.shanutechx.com` : 'Set Custom Subdomain…'}
                rightIcon={<Ionicons name="create-outline" size={14} color={colors.primary} />}
                mono
                highlight
              />
            </Pressable>
            <InfoRow
              label="Environment Vars"
              value={deployment.envVars && deployment.envVars.length > 0 ? `${deployment.envVars.length} defined` : 'None'}
            />
            <InfoRow
              label="Created"
              value={new Date(deployment.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
            />
            <InfoRow
              label="Last Updated"
              value={new Date(deployment.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              last
            />
          </GlassCard>

          {/* Logs Section */}
          <View style={styles.logHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Live Container Logs</Text>
              <Text style={styles.logSub}>Real-time STDOUT/STDERR telemetry</Text>
            </View>
            <Pressable
              style={styles.refreshLogsBtn}
              onPress={refreshOnlyLogs}
              disabled={actionLoading === 'logs'}
            >
              <Ionicons name="sync-outline" size={12} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.refreshLogsText}>
                {actionLoading === 'logs' ? 'Fetching…' : 'Refresh Logs'}
              </Text>
            </Pressable>
          </View>

          {/* Filter Chips */}
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

          <GlassCard style={styles.logsCard}>
            {!filteredLogs ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={styles.muted}>No log output matching filter "{logFilter.toUpperCase()}".</Text>
              </View>
            ) : (
              <ScrollView nestedScrollEnabled style={styles.logsScrollView}>
                <Text selectable style={styles.logText}>{filteredLogs}</Text>
              </ScrollView>
            )}
          </GlassCard>
        </>
      )}

      {/* Subdomain Edit Modal */}
      <Modal visible={subdomainModalVisible} transparent animationType="fade" onRequestClose={() => setSubdomainModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Configure Subdomain</Text>
            <Text style={styles.modalSubtitle}>
              Direct Cloudflare DNS will be created automatically under *.shanutechx.com
            </Text>
            <View style={styles.subdomainInputContainer}>
              <TextInput
                value={newSubdomain}
                onChangeText={setNewSubdomain}
                placeholder="my-cool-app"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.subdomainInput}
              />
              <Text style={styles.subdomainSuffix}>.shanutechx.com</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Button label="Cancel" variant="glass" size="sm" onPress={() => setSubdomainModalVisible(false)} style={{ flex: 1 }} />
              <Button label="Save & Route" variant="primary" size="sm" onPress={handleSaveSubdomain} loading={subdomainSaving} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({
  label,
  value,
  mono,
  highlight,
  last,
  rightIcon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  last?: boolean;
  rightIcon?: React.ReactNode;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, marginLeft: 12 }}>
        <Text
          style={[
            styles.infoValue,
            mono && { fontFamily: 'monospace' },
            highlight && { color: colors.primary, fontFamily: fontFamily.bodyMedium },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
        {rightIcon}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontFamily: fontFamily.head, fontSize: 20, color: colors.onSurface },
  id: { fontSize: 11, color: colors.muted, marginTop: 2, fontFamily: 'monospace' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontFamily: fontFamily.headSemibold, fontSize: 11, letterSpacing: 0.5 },
  actionsRow: { flexDirection: 'row', marginTop: 4 },
  sectionTitle: {
    fontFamily: fontFamily.headSemibold,
    fontSize: 14,
    color: colors.onSurface,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  infoLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 13, color: colors.muted },
  infoValue: { fontFamily: fontFamily.body, fontSize: 13, color: colors.onSurface, marginLeft: 12, flexShrink: 1, textAlign: 'right' },
  logHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 8 },
  logSub: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted },
  refreshLogsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  refreshLogsText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    color: colors.primary,
  },
  logFilterChips: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  logChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  logChipActive: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  logChipText: { fontFamily: fontFamily.bodyMedium, fontSize: 10, color: colors.muted },
  logChipTextActive: { color: colors.primary },
  logsCard: {
    padding: 12,
    backgroundColor: '#050408',
    borderColor: 'rgba(255,255,255,0.07)',
  },
  logsScrollView: { maxHeight: 300 },
  logText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#a5b4fc',
    lineHeight: 18,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.bgScreen2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, padding: 20 },
  modalTitle: { fontFamily: fontFamily.headSemibold, fontSize: 17, color: colors.onSurface },
  modalSubtitle: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: 14 },
  subdomainInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
  },
  subdomainInput: {
    flex: 1,
    height: 46,
    color: colors.onSurface,
    fontFamily: fontFamily.body,
    fontSize: 14,
  },
  subdomainSuffix: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: colors.muted,
  },
  muted: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 13 },
});
