import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Image, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { api, Payment, ApiError } from '@/lib/api';
import { colors, fontFamily, radius } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

function formatLkr(n: number | undefined): string {
  if (n === undefined) return '';
  return `Rs ${n.toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

export function PaymentsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [declineTarget, setDeclineTarget] = useState<Payment | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    try {
      const { payments } = await api.payments.reviewQueue();
      setPayments(payments);
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

  function showToast(text: string, kind: 'success' | 'error') {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 2500);
  }

  async function handleApprove(payment: Payment) {
    setBusyId(payment.id);
    try {
      await api.payments.review(payment.id, true);
      showToast('Payment approved.', 'success');
      load();
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
      load();
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
          <Text style={styles.subtitle}>{payments?.length ?? 0} awaiting manual review</Text>
        </View>
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
            <Text style={{ color: colors.error }}>{error}</Text>
          ) : (
            <GlassCard><Text style={styles.muted}>No payments waiting for review. 🎉</Text></GlassCard>
          )
        }
        renderItem={({ item }) => (
          <GlassCard style={{ marginBottom: 12 }}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.customer} numberOfLines={1}>{item.order?.user?.email ?? 'Unknown customer'}</Text>
                <Text style={styles.orderRef}>Order #{item.orderId.slice(0, 8).toUpperCase()}</Text>
              </View>
              <Text style={styles.amount}>{formatLkr(item.order?.totalLkr)}</Text>
            </View>

            {item.proofUrl && (
              <Pressable onPress={() => setPreviewProofUrl(item.proofUrl)} style={styles.proofContainer}>
                <Image source={{ uri: item.proofUrl }} style={styles.proof} resizeMode="cover" />
                <View style={styles.zoomHint}>
                  <Text style={styles.zoomHintText}>🔍 Tap to inspect slip</Text>
                </View>
              </Pressable>
            )}

            <View style={styles.metaRow}>
              <Badge status={item.status} />
              <Text style={styles.method}>{item.method}</Text>
            </View>

            <View style={styles.actions}>
              <Button label="Approve" variant="success" size="sm" onPress={() => handleApprove(item)} loading={busyId === item.id} style={{ flex: 1 }} />
              <Button label="Decline" variant="danger" size="sm" onPress={() => openDecline(item)} disabled={busyId === item.id} style={{ flex: 1 }} />
            </View>
          </GlassCard>
        )}
      />

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
              placeholder="e.g. Slip amount does not match the order total"
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
  muted: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 40 },
  toast: { marginHorizontal: 20, marginTop: 10, padding: 10, borderRadius: radius.sm, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  customer: { fontFamily: fontFamily.bodySemibold, fontSize: 14, color: colors.onSurface },
  orderRef: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, marginTop: 2 },
  amount: { fontFamily: fontFamily.headSemibold, fontSize: 15, color: colors.primary },
  proofContainer: { position: 'relative', marginTop: 12 },
  proof: { width: '100%', height: 160, borderRadius: radius.sm, backgroundColor: colors.bgScreen2 },
  zoomHint: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  zoomHintText: { fontFamily: fontFamily.bodyMedium, fontSize: 10, color: colors.onSurface },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  method: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, textTransform: 'capitalize' },
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
