import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Modal,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/AuthContext';
import { api, Ticket, ApiError } from '@/lib/api';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { colors, fontFamily, radius } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

type ChatRoute = RouteProp<RootStackParamList, 'TicketChat'>;

export function TicketChatScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ChatRoute>();
  const { apiUser } = useAuth();
  const { ticketId, subject } = route.params;
  const insets = useSafeAreaInsets();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Close ticket modal state
  const [closeModalVisible, setCloseModalVisible] = useState(false);
  const [closeReason, setCloseReason] = useState('');

  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const { ticket } = await api.tickets.get(ticketId);
      setTicket(ticket);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    setSending(true);
    try {
      await api.tickets.reply(ticketId, body);
      await load();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      setError(err.message);
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  async function handleClaim() {
    setBusyAction('claim');
    try {
      await api.tickets.claim(ticketId);
      Alert.alert('Success', 'You have claimed this ticket.');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Failed to claim ticket');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUnclaim() {
    setBusyAction('unclaim');
    try {
      await api.tickets.unclaim(ticketId);
      Alert.alert('Success', 'Ticket returned to open queue.');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Failed to unclaim ticket');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleConfirmClose() {
    if (!closeReason.trim()) return;
    setBusyAction('close');
    try {
      await api.tickets.close(ticketId, closeReason.trim());
      setCloseModalVisible(false);
      Alert.alert('Success', 'Ticket closed and transcript saved.');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Failed to close ticket');
    } finally {
      setBusyAction(null);
    }
  }

  const messages = ticket?.messages ?? [];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bgBase }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ color: colors.onSurface, fontSize: 18, lineHeight: 22 }}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{subject}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {ticket && <Badge status={ticket.status} />}
            <Text style={styles.headerCustomer}>{ticket?.user?.email ?? ''}</Text>
          </View>
        </View>
      </View>

      {/* Staff Actions Bar */}
      {ticket && ticket.status !== 'closed' && (
        <View style={styles.staffActionBar}>
          <Button
            label="Claim"
            variant="glass"
            size="sm"
            onPress={handleClaim}
            loading={busyAction === 'claim'}
            style={{ flex: 1 }}
          />
          <Button
            label="Unclaim"
            variant="glass"
            size="sm"
            onPress={handleUnclaim}
            loading={busyAction === 'unclaim'}
            style={{ flex: 1 }}
          />
          <Button
            label="Close"
            variant="danger"
            size="sm"
            onPress={() => {
              setCloseReason('Resolved by staff via mobile app');
              setCloseModalVisible(true);
            }}
            loading={busyAction === 'close'}
            style={{ flex: 1 }}
          />
        </View>
      )}

      {error && <Text style={{ color: colors.error, paddingHorizontal: 20, fontSize: 12, marginTop: 4 }}>{error}</Text>}

      {/* Message History List */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 20, gap: 10 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMine = item.senderRole === 'admin';
          return (
            <View style={[styles.bubbleRow, isMine && { justifyContent: 'flex-end' }]}>
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleSender, isMine && { color: 'rgba(26,15,51,0.7)' }]}>
                  {item.sender?.displayName || item.sender?.email || (isMine ? 'Staff' : 'Customer')}
                </Text>
                <Text style={[styles.bubbleText, isMine && { color: '#1a0f33' }]}>{item.body}</Text>
                <Text style={[styles.bubbleTime, isMine && { color: 'rgba(26,15,51,0.6)' }]}>
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Reply Input Bar */}
      <View style={styles.inputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Reply to customer…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          multiline
        />
        <Pressable onPress={handleSend} disabled={sending || !draft.trim()} style={[styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.5 }]}>
          <Text style={{ color: '#1a0f33', fontFamily: fontFamily.headSemibold, fontSize: 13 }}>Send</Text>
        </Pressable>
      </View>

      {/* Close Ticket Reason Modal */}
      <Modal visible={closeModalVisible} transparent animationType="fade" onRequestClose={() => setCloseModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Close Support Ticket</Text>
            <Text style={styles.modalSubtitle}>Enter closure summary/reason for customer transcript record:</Text>
            <TextInput
              value={closeReason}
              onChangeText={setCloseReason}
              placeholder="e.g. Issue resolved by engineering"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              style={styles.modalTextarea}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button label="Cancel" variant="glass" size="sm" onPress={() => setCloseModalVisible(false)} style={{ flex: 1 }} />
              <Button
                label="Confirm Close"
                variant="danger"
                size="sm"
                onPress={handleConfirmClose}
                loading={busyAction === 'close'}
                disabled={!closeReason.trim()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass },
  headerTitle: { fontFamily: fontFamily.bodySemibold, fontSize: 15, color: colors.onSurface, marginBottom: 2 },
  headerCustomer: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted },
  staffActionBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.02)', borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '82%', borderRadius: radius.md, padding: 12 },
  bubbleTheirs: { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleSender: { fontFamily: fontFamily.bodySemibold, fontSize: 11, color: colors.primary, marginBottom: 4 },
  bubbleText: { fontFamily: fontFamily.body, fontSize: 14, color: colors.onSurface, lineHeight: 20 },
  bubbleTime: { fontFamily: fontFamily.body, fontSize: 9, color: colors.muted, marginTop: 6, textAlign: 'right' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.glassBorder },
  input: { flex: 1, maxHeight: 100, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: 'rgba(255,255,255,0.04)', color: colors.onSurface, fontFamily: fontFamily.body, fontSize: 14, padding: 12 },
  sendBtn: { height: 42, paddingHorizontal: 18, borderRadius: radius.sm, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.bgScreen2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, padding: 20 },
  modalTitle: { fontFamily: fontFamily.headSemibold, fontSize: 16, color: colors.onSurface },
  modalSubtitle: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginTop: 6, lineHeight: 17 },
  modalTextarea: {
    marginTop: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
    color: colors.onSurface,
    fontFamily: fontFamily.body,
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
