import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Image, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform, Linking, ScrollView } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { api, Payment, ApiError, API_BASE } from '@/lib/api';
import { colors, fontFamily, radius } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

function formatLkr(n: number | undefined): string {
  if (n === undefined) return '';
  return `Rs ${n.toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

function resolveProofUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${API_BASE}${cleanPath}`;
}

type FilterTab = 'manual_review' | 'manually_approved' | 'rejected' | 'all';

export function PaymentsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterTab>('manual_review');

  const [declineTarget, setDeclineTarget] = useState<Payment | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);

  const load = useCallback(async (filter: FilterTab = statusFilter) => {
    try {
      const { payments } = await api.payments.reviewQueue(filter);
      setPayments(payments);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, [statusFilter]);

  useFocusEffect(useCallback(() => { load(statusFilter); }, [load, statusFilter]));

  async function onRefresh() {
    setRefreshing(true);
    await load(statusFilter);
    setRefreshing(false);
  }

  function handleFilterChange(tab: FilterTab) {
    setStatusFilter(tab);
    setPayments(null);
    load(tab);
  }

  function showToast(text: string, kind: 'success' | 'error') {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 2500);
  }

  async function handleApprove(payment: Payment) {
    setBusyId(payment.id);
    try {
      await api.payments.review(payment.id, true);
      showToast('Payment approved.', 'success');
      load(statusFilter);
    } catch (err: any) {
      showToast(err instanceof ApiError ? err.message : 'Failed to approve.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  function openDecline(payment: Payment) {
    setDeclineReason('');
    setDeclineTarget(payment);
  }

  async function confirmDecline() {
    if (!declineTarget || !declineReason.trim()) return;
    setBusyId(declineTarget.id);
    try {
      await api.payments.review(declineTarget.id, false, declineReason.trim());
      showToast('Payment declined.', 'error');
      setDeclineTarget(null);
      load(statusFilter);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ color: colors.onSurface, fontSize: 20, lineHeight: 24 }}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Payment Review</Text>
          <Text style={styles.subtitle}>{payments?.length ?? 0} payments matching filter</Text>
        </View>
      </View>

      {/* Status Filter Tabs */}
      <View style={styles.tabBar}>
        {(['manual_review', 'manually_approved', 'rejected', 'all'] as FilterTab[]).map((tab) => {
          const labels: Record<FilterTab, string> = {
            manual_review: 'Pending',
            manually_approved: 'Approved',
            rejected: 'Declined',
            all: 'All',
          };
          const isActive = statusFilter === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => handleFilterChange(tab)}
              style={[styles.tab, isActive && styles.activeTab]}
            >
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>{labels[tab]}</Text>
            </Pressable>
          );
        })}
      </View>

      {toast && (
        <View style={[styles.toast, { borderColor: toast.kind === 'success' ? 'rgba(74,222,128,0.4)' : 'rgba(239,68,68,0.4)' }]}>
          <Text style={{ color: toast.kind === 'success' ? colors.success : colors.error, fontFamily: fontFamily.bodyMedium, fontSize: 13 }}>
            {toast.text}
          </Text>
        </View>
      )}

      <FlatList
        data={payments ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          !payments ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : error ? (
            <Text style={{ color: colors.error, textAlign: 'center', marginTop: 40 }}>{error}</Text>
          ) : (
            <GlassCard><Text style={styles.muted}>No payments found for this filter.</Text></GlassCard>
          )
        }
        renderItem={({ item }) => {
          const fullProofUrl = resolveProofUrl(item.proofUrl);
          const isPdf = fullProofUrl?.toLowerCase().includes('.pdf');

          return (
            <GlassCard style={{ marginBottom: 16 }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customer} numberOfLines={1}>{item.order?.user?.email ?? 'Unknown customer'}</Text>
                  <Text style={styles.orderRef}>Order #{item.orderId.slice(0, 8).toUpperCase()}</Text>
                </View>
                <Text style={styles.amount}>{formatLkr(item.order?.totalLkr ?? item.order?.total)}</Text>
              </View>

              {/* Order items summary */}
              {item.order?.items && item.order.items.length > 0 && (
                <View style={styles.itemsBox}>
                  {item.order.items.map((it) => (
                    <Text key={it.id} style={styles.itemText} numberOfLines={1}>
                      • {it.quantity}x {it.service?.name ?? it.plan?.name ?? 'Service'}
                    </Text>
                  ))}
                </View>
              )}

              {/* Proof section */}
              {fullProofUrl ? (
                isPdf ? (
                  <Pressable onPress={() => Linking.openURL(fullProofUrl)} style={styles.pdfCard}>
                    <Text style={{ fontSize: 24 }}>📄</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pdfTitle}>PDF Proof Document</Text>
                      <Text style={styles.pdfSub}>Tap to view/download PDF slip</Text>
                    </View>
                    <Text style={{ color: colors.primary, fontSize: 13, fontFamily: fontFamily.bodySemibold }}>Open ↗</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => setPreviewProofUrl(fullProofUrl)} style={styles.proofContainer}>
                    <Image source={{ uri: fullProofUrl }} style={styles.proof} resizeMode="cover" />
                    <View style={styles.zoomHint}>
                      <Text style={styles.zoomHintText}>Tap to inspect slip</Text>
                    </View>
                  </Pressable>
                )
              ) : (
                <View style={styles.noProofBox}>
                  <Text style={styles.noProofText}>No payment proof uploaded</Text>
                </View>
              )}

              {/* OCR Extracted Metadata */}
              {item.extractedJson && Object.keys(item.extractedJson).length > 0 && (
                <View style={styles.metaBox}>
                  <Text style={styles.metaBoxTitle}>Extracted Transaction Data</Text>
                  {item.extractedJson.referenceNumber && (
                    <Text style={styles.metaText}>Ref: <Text style={{ color: colors.onSurface }}>{item.extractedJson.referenceNumber}</Text></Text>
                  )}
                  {item.extractedJson.bankName && (
                    <Text style={styles.metaText}>Bank: <Text style={{ color: colors.onSurface }}>{item.extractedJson.bankName}</Text></Text>
                  )}
                  {item.extractedJson.depositDate && (
                    <Text style={styles.metaText}>Date: <Text style={{ color: colors.onSurface }}>{item.extractedJson.depositDate}</Text></Text>
                  )}
                  {item.confidenceScore !== undefined && item.confidenceScore !== null && (
                    <Text style={styles.metaText}>Match Confidence: <Text style={{ color: colors.primary }}>{Math.round(item.confidenceScore * 100)}%</Text></Text>
                  )}
                </View>
              )}

              <View style={styles.metaRow}>
                <Badge status={item.status} />
                <Text style={styles.method}>{item.method.replace('_', ' ')}</Text>
                <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>

              {item.rejectionReason && (
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonTitle}>Decline Reason:</Text>
                  <Text style={styles.reasonText}>{item.rejectionReason}</Text>
                </View>
              )}

              {item.status === 'manual_review' && (
                <View style={styles.actions}>
                  <Button label="Approve" variant="success" size="sm" onPress={() => handleApprove(item)} loading={busyId === item.id} style={{ flex: 1 }} />
                  <Button label="Decline" variant="danger" size="sm" onPress={() => openDecline(item)} disabled={busyId === item.id} style={{ flex: 1 }} />
                </View>
              )}
            </GlassCard>
          );
        }}
      />

      {/* Decline Reason Input Modal */}
      <Modal visible={!!declineTarget} transparent animationType="fade" onRequestClose={() => setDeclineTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Decline payment for order #{declineTarget?.orderId.slice(0, 8).toUpperCase()}
            </Text>
            <Text style={styles.modalSubtitle}>
              This reason is sent directly to the customer. Required — declines without one are rejected by the server.
            </Text>
            <TextInput
              value={declineReason}
              onChangeText={setDeclineReason}
              placeholder="e.g. Bank slip reference number does not match total amount"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={4}
              style={styles.textarea}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button label="Cancel" variant="glass" size="sm" onPress={() => setDeclineTarget(null)} style={{ flex: 1 }} />
              <Button
                label="Confirm Decline"
                variant="danger"
                size="sm"
                onPress={confirmDecline}
                loading={busyId === declineTarget?.id}
                disabled={!declineReason.trim()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Full-screen Proof Slip Image Preview Modal */}
      <Modal visible={!!previewProofUrl} transparent animationType="fade" onRequestClose={() => setPreviewProofUrl(null)}>
        <View style={styles.imageModalContainer}>
          <Pressable style={styles.imageModalOverlay} onPress={() => setPreviewProofUrl(null)} />
          {previewProofUrl && (
            <View style={styles.imageCard}>
              <View style={styles.imageHeader}>
                <Text style={styles.imageModalTitle}>Payment Proof Slip</Text>
                <Pressable onPress={() => setPreviewProofUrl(null)} style={styles.closeBtn}>
                  <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: 'bold' }}>✕</Text>
                </Pressable>
              </View>
              <Image source={{ uri: previewProofUrl }} style={styles.fullProofImage} resizeMode="contain" />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { fontFamily: fontFamily.head, fontSize: 20, color: colors.onSurface },
  subtitle: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  tabBar: { flexDirection: 'row', paddingHorizontal: 20, marginVertical: 10, gap: 8 },
  tab: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center' },
  activeTab: { backgroundColor: 'rgba(129,140,248,0.15)', borderColor: colors.primary },
  tabText: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.muted },
  activeTabText: { color: colors.primary, fontFamily: fontFamily.bodySemibold },
  muted: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 40 },
  toast: { marginHorizontal: 20, marginTop: 10, padding: 10, borderRadius: radius.sm, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  customer: { fontFamily: fontFamily.bodySemibold, fontSize: 14, color: colors.onSurface },
  orderRef: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, marginTop: 2 },
  amount: { fontFamily: fontFamily.headSemibold, fontSize: 15, color: colors.primary },
  itemsBox: { marginTop: 8, padding: 8, borderRadius: radius.xs, backgroundColor: 'rgba(255,255,255,0.03)' },
  itemText: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted },
  proofContainer: { position: 'relative', marginTop: 12 },
  proof: { width: '100%', height: 160, borderRadius: radius.sm, backgroundColor: colors.bgScreen2 },
  zoomHint: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  zoomHintText: { fontFamily: fontFamily.bodyMedium, fontSize: 10, color: colors.onSurface },
  pdfCard: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.glassBorder },
  pdfTitle: { fontFamily: fontFamily.bodySemibold, fontSize: 13, color: colors.onSurface },
  pdfSub: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted },
  noProofBox: { marginTop: 12, padding: 16, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center' },
  noProofText: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, fontStyle: 'italic' },
  metaBox: { marginTop: 10, padding: 10, borderRadius: radius.xs, backgroundColor: 'rgba(129,140,248,0.06)', borderWidth: 1, borderColor: 'rgba(129,140,248,0.2)' },
  metaBoxTitle: { fontFamily: fontFamily.bodySemibold, fontSize: 11, color: colors.primary, marginBottom: 4 },
  metaText: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  method: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, textTransform: 'capitalize' },
  dateText: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, marginLeft: 'auto' },
  reasonBox: { marginTop: 10, padding: 8, borderRadius: radius.xs, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  reasonTitle: { fontFamily: fontFamily.bodySemibold, fontSize: 11, color: colors.error },
  reasonText: { fontFamily: fontFamily.body, fontSize: 12, color: colors.onSurface, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.bgScreen2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, padding: 20 },
  modalTitle: { fontFamily: fontFamily.headSemibold, fontSize: 15, color: colors.onSurface },
  modalSubtitle: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginTop: 6, lineHeight: 17 },
  textarea: {
    marginTop: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
    color: colors.onSurface,
    fontFamily: fontFamily.body,
    fontSize: 13,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  imageModalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)', padding: 16 },
  imageModalOverlay: { ...StyleSheet.absoluteFillObject },
  imageCard: { width: '100%', maxHeight: '80%', backgroundColor: colors.bgScreen, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, overflow: 'hidden', padding: 16 },
  imageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  imageModalTitle: { fontFamily: fontFamily.headSemibold, fontSize: 15, color: colors.onSurface },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center' },
  fullProofImage: { width: '100%', height: 400, borderRadius: radius.sm },
});

