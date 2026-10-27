import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Image,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ScrollView,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { api, Payment, ApiError, resolveProofUrl } from '@/lib/api';
import { colors, fontFamily, radius, spacing } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

function formatLkr(n: number | null | undefined): string {
  if (n === undefined || n === null || isNaN(n)) return 'Rs 0';
  return `Rs ${Number(n).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

function ReceiptSlipImage({ uri, onPreview }: { uri: string; onPreview: () => void }) {
  const [loadError, setLoadError] = useState(false);

  if (loadError) {
    return (
      <Pressable onPress={() => Linking.openURL(uri)} style={styles.pdfCard}>
        <Ionicons name="image-outline" size={24} color={colors.warning} />
        <View style={{ flex: 1 }}>
          <Text style={styles.pdfTitle}>Receipt Image Attached</Text>
          <Text style={styles.pdfSub}>Tap to open in external browser</Text>
        </View>
        <Ionicons name="open-outline" size={13} color={colors.warning} />
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPreview} style={styles.proofContainer}>
      <Image
        source={{ uri }}
        style={styles.proofImage}
        resizeMode="cover"
        onError={() => setLoadError(true)}
      />
      <View style={styles.zoomHint}>
        <Ionicons name="scan-outline" size={12} color="#ffffff" />
        <Text style={styles.zoomHintText}>Tap to inspect receipt</Text>
      </View>
    </Pressable>
  );
}

type FilterTab = 'manual_review' | 'manually_approved' | 'rejected' | 'all';

const DECLINE_PRESETS = [
  'Bank slip reference number does not match record',
  'Deposit slip image is blurred or truncated',
  'Deposited amount does not match invoice total',
  'Duplicate transaction — slip already processed',
];

export function PaymentsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterTab>('manual_review');
  const [search, setSearch] = useState('');

  // Modals
  const [declineTarget, setDeclineTarget] = useState<Payment | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);

  const load = useCallback(async (filter: FilterTab = statusFilter) => {
    try {
      const { payments: list } = await api.payments.reviewQueue(filter);
      setPayments(list || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load payments queue');
    }
  }, [statusFilter]);

  useFocusEffect(
    useCallback(() => {
      load(statusFilter);
    }, [load, statusFilter])
  );

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
    setTimeout(() => setToast(null), 3000);
  }

  async function handleApprove(payment: Payment) {
    const amountStr = formatLkr(payment.order?.totalLkr ?? payment.order?.total);
    Alert.alert(
      'Approve Payment & Provision',
      `Approve payment of ${amountStr} for Order #${payment.orderId.slice(0, 8).toUpperCase()}? This will immediately provision hosting resources and activate subscriptions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve & Provision',
          onPress: async () => {
            setBusyId(payment.id);
            try {
              await api.payments.review(payment.id, true);
              showToast(`Order #${payment.orderId.slice(0, 8).toUpperCase()} approved!`, 'success');
              load(statusFilter);
            } catch (err: any) {
              showToast(err instanceof ApiError ? err.message : 'Failed to approve payment', 'error');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
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
      showToast(`Order #${declineTarget.orderId.slice(0, 8).toUpperCase()} declined.`, 'error');
      setDeclineTarget(null);
      load(statusFilter);
    } catch (err: any) {
      showToast(err.message || 'Failed to decline payment', 'error');
    } finally {
      setBusyId(null);
    }
  }

  const visiblePayments = (payments ?? []).filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const emailMatch = p.order?.user?.email?.toLowerCase().includes(q);
    const orderMatch = p.orderId.toLowerCase().includes(q);
    const refMatch =
      p.extractedJson?.referenceNumber &&
      String(p.extractedJson.referenceNumber).toLowerCase().includes(q);
    return emailMatch || orderMatch || refMatch;
  });

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Payment Review Queue</Text>
          <Text style={styles.subtitle}>
            {payments ? `${visiblePayments.length} of ${payments.length} orders shown` : 'Loading…'}
          </Text>
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

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search customer email, order ID, or reference…"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} style={styles.clearSearch}>
            <Ionicons name="close-circle" size={16} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {toast && (
        <View
          style={[
            styles.toast,
            {
              backgroundColor: toast.kind === 'success' ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)',
              borderColor: toast.kind === 'success' ? 'rgba(74,222,128,0.4)' : 'rgba(239,68,68,0.4)',
            },
          ]}
        >
          <Text
            style={{
              color: toast.kind === 'success' ? colors.success : colors.error,
              fontFamily: fontFamily.bodySemibold,
              fontSize: 13,
            }}
          >
            {toast.text}
          </Text>
        </View>
      )}

      {/* Payment List */}
      <FlatList
        data={visiblePayments}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 20, paddingTop: 10, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          !payments ? (
            <Text style={styles.muted}>Loading payments from server…</Text>
          ) : error ? (
            <GlassCard style={{ borderColor: 'rgba(239,68,68,0.4)' }}>
              <Text style={{ color: colors.error, textAlign: 'center' }}>{error}</Text>
            </GlassCard>
          ) : (
            <GlassCard style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Ionicons name="card-outline" size={32} color={colors.muted} style={{ marginBottom: 6 }} />
              <Text style={{ color: colors.onSurface, fontFamily: fontFamily.headSemibold, fontSize: 14 }}>
                No payments found
              </Text>
              <Text style={[styles.muted, { marginTop: 4 }]}>
                {search ? 'Try clearing your search query.' : 'No transactions matching this filter.'}
              </Text>
            </GlassCard>
          )
        }
        renderItem={({ item }) => {
          const fullProofUrl = resolveProofUrl(item.proofUrl);
          const isPdf = fullProofUrl?.toLowerCase().includes('.pdf');

          return (
            <GlassCard style={styles.card}>
              {/* Customer & Total */}
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.customer} numberOfLines={1}>
                    {item.order?.user?.email || 'Unknown customer'}
                  </Text>
                  <Text style={styles.orderRef}>
                    Order #{item.orderId.slice(0, 8).toUpperCase()} · {item.method.replace(/_/g, ' ')}
                  </Text>
                </View>
                <Text style={styles.amount}>{formatLkr(item.order?.totalLkr ?? item.order?.total)}</Text>
              </View>

              {/* Order Items */}
              {item.order?.items && item.order.items.length > 0 && (
                <View style={styles.itemsBox}>
                  {item.order.items.map((it) => (
                    <Text key={it.id} style={styles.itemText} numberOfLines={1}>
                      • {it.quantity}x {it.service?.name || it.plan?.name || 'Cloud Service'}
                    </Text>
                  ))}
                </View>
              )}

              {/* Proof Slip Preview */}
              {fullProofUrl ? (
                isPdf ? (
                  <Pressable onPress={() => Linking.openURL(fullProofUrl)} style={styles.pdfCard}>
                    <Ionicons name="document-text-outline" size={26} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pdfTitle}>PDF Payment Receipt</Text>
                      <Text style={styles.pdfSub}>Tap to open in external viewer</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={styles.pdfLink}>Open</Text>
                      <Ionicons name="open-outline" size={13} color={colors.primary} />
                    </View>
                  </Pressable>
                ) : (
                  <ReceiptSlipImage uri={fullProofUrl} onPreview={() => setPreviewProofUrl(fullProofUrl)} />
                )
              ) : (
                <View style={styles.noProofBox}>
                  <Text style={styles.noProofText}>No receipt slip uploaded</Text>
                </View>
              )}

              {/* Extracted Transaction Data (AI / Groq OCR) */}
              {item.extractedJson && Object.keys(item.extractedJson).length > 0 && (
                <View style={styles.ocrBox}>
                  <Text style={styles.ocrTitle}>AI Transaction Extraction</Text>
                  {item.extractedJson.referenceNumber && (
                    <Text style={styles.ocrText}>
                      Ref: <Text style={{ color: colors.onSurface }}>{item.extractedJson.referenceNumber}</Text>
                    </Text>
                  )}
                  {item.extractedJson.bankName && (
                    <Text style={styles.ocrText}>
                      Bank: <Text style={{ color: colors.onSurface }}>{item.extractedJson.bankName}</Text>
                    </Text>
                  )}
                  {item.extractedJson.depositDate && (
                    <Text style={styles.ocrText}>
                      Date: <Text style={{ color: colors.onSurface }}>{item.extractedJson.depositDate}</Text>
                    </Text>
                  )}
                  {item.confidenceScore !== undefined && item.confidenceScore !== null && (
                    <Text style={styles.ocrText}>
                      Confidence: <Text style={{ color: colors.primary }}>{Math.round(item.confidenceScore * 100)}%</Text>
                    </Text>
                  )}
                </View>
              )}

              {/* Meta Row */}
              <View style={styles.metaRow}>
                <Badge status={item.status} />
                <Text style={styles.dateText}>
                  {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              {/* Decline Reason if rejected */}
              {item.rejectionReason && (
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonTitle}>Decline Reason:</Text>
                  <Text style={styles.reasonText}>{item.rejectionReason}</Text>
                </View>
              )}

              {/* Action Buttons for Pending Items */}
              {item.status === 'manual_review' && (
                <View style={styles.actions}>
                  <Button
                    label="Approve"
                    icon={<Ionicons name="checkmark-circle-outline" size={14} color="#ffffff" />}
                    variant="success"
                    size="sm"
                    onPress={() => handleApprove(item)}
                    loading={busyId === item.id}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Decline"
                    icon={<Ionicons name="close-circle-outline" size={14} color="#ffffff" />}
                    variant="danger"
                    size="sm"
                    onPress={() => openDecline(item)}
                    disabled={busyId === item.id}
                    style={{ flex: 1 }}
                  />
                </View>
              )}
            </GlassCard>
          );
        }}
      />

      {/* Decline Reason Modal */}
      <Modal visible={!!declineTarget} transparent animationType="fade" onRequestClose={() => setDeclineTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Decline Order #{declineTarget?.orderId.slice(0, 8).toUpperCase()}
            </Text>
            <Text style={styles.modalSubtitle}>
              Select a predefined reason or enter a detailed notice sent directly to the customer:
            </Text>

            {/* Presets */}
            <View style={{ gap: 6, marginVertical: 10 }}>
              {DECLINE_PRESETS.map((preset) => (
                <Pressable
                  key={preset}
                  onPress={() => setDeclineReason(preset)}
                  style={[styles.presetItem, declineReason === preset && styles.presetItemActive]}
                >
                  <Text style={[styles.presetText, declineReason === preset && { color: colors.primary }]}>
                    • {preset}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={declineReason}
              onChangeText={setDeclineReason}
              placeholder="Or type custom decline explanation…"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              style={styles.textarea}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button label="Cancel" variant="glass" size="sm" onPress={() => setDeclineTarget(null)} style={{ flex: 1 }} />
              <Button
                label="Confirm Decline"
                icon={<Ionicons name="close-circle-outline" size={14} color="#ffffff" />}
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

      {/* Full-screen Receipt Image Viewer */}
      <Modal visible={!!previewProofUrl} transparent animationType="fade" onRequestClose={() => setPreviewProofUrl(null)}>
        <View style={styles.imageModalContainer}>
          <Pressable style={styles.imageModalOverlay} onPress={() => setPreviewProofUrl(null)} />
          {previewProofUrl && (
            <View style={styles.imageCard}>
              <View style={styles.imageHeader}>
                <Text style={styles.imageModalTitle}>Payment Receipt Slip</Text>
                <Pressable onPress={() => setPreviewProofUrl(null)} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={colors.onSurface} />
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
  header: { paddingHorizontal: 20, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { color: colors.onSurface, fontSize: 22, lineHeight: 26 },
  title: { fontFamily: fontFamily.head, fontSize: 20, color: colors.onSurface },
  subtitle: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  tabBar: { flexDirection: 'row', paddingHorizontal: 20, marginVertical: 8, gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
  },
  activeTab: { backgroundColor: 'rgba(207,188,255,0.15)', borderColor: colors.primary },
  tabText: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.muted },
  activeTabText: { color: colors.primary, fontFamily: fontFamily.bodySemibold },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, height: 38, fontFamily: fontFamily.body, fontSize: 13, color: colors.onSurface },
  clearSearch: { padding: 6 },
  muted: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 30 },
  toast: { marginHorizontal: 20, marginBottom: 8, padding: 10, borderRadius: radius.sm, borderWidth: 1 },
  card: { marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  customer: { fontFamily: fontFamily.bodySemibold, fontSize: 14, color: colors.onSurface },
  orderRef: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, marginTop: 2 },
  amount: { fontFamily: fontFamily.headSemibold, fontSize: 15, color: colors.primary },
  itemsBox: { marginTop: 8, padding: 8, borderRadius: radius.xs, backgroundColor: 'rgba(255,255,255,0.03)' },
  itemText: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted },
  proofContainer: { position: 'relative', marginTop: 10 },
  proofImage: { width: '100%', height: 160, borderRadius: radius.sm, backgroundColor: colors.bgScreen2 },
  zoomHint: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  zoomHintText: { fontFamily: fontFamily.bodyMedium, fontSize: 10, color: colors.onSurface },
  pdfCard: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pdfTitle: { fontFamily: fontFamily.bodySemibold, fontSize: 13, color: colors.onSurface },
  pdfSub: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted },
  pdfLink: { color: colors.primary, fontSize: 12, fontFamily: fontFamily.bodySemibold },
  noProofBox: {
    marginTop: 10,
    padding: 14,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
  },
  noProofText: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, fontStyle: 'italic' },
  ocrBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(207,188,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(207,188,255,0.2)',
  },
  ocrTitle: { fontFamily: fontFamily.bodySemibold, fontSize: 11, color: colors.primary, marginBottom: 4 },
  ocrText: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, marginTop: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  dateText: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted },
  reasonBox: {
    marginTop: 10,
    padding: 8,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  reasonTitle: { fontFamily: fontFamily.bodySemibold, fontSize: 11, color: colors.error },
  reasonText: { fontFamily: fontFamily.body, fontSize: 12, color: colors.onSurface, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.bgScreen2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, padding: 20 },
  modalTitle: { fontFamily: fontFamily.headSemibold, fontSize: 16, color: colors.onSurface },
  modalSubtitle: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 17 },
  presetItem: { padding: 8, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: colors.glassBorder },
  presetItemActive: { borderColor: colors.primary, backgroundColor: 'rgba(207,188,255,0.1)' },
  presetText: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted },
  textarea: {
    marginTop: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
    color: colors.onSurface,
    fontFamily: fontFamily.body,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  imageModalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.88)', padding: 16 },
  imageModalOverlay: { ...StyleSheet.absoluteFillObject },
  imageCard: { width: '100%', maxHeight: '85%', backgroundColor: colors.bgScreen, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, padding: 16 },
  imageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  imageModalTitle: { fontFamily: fontFamily.headSemibold, fontSize: 15, color: colors.onSurface },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center' },
  fullProofImage: { width: '100%', height: 420, borderRadius: radius.sm },
});
