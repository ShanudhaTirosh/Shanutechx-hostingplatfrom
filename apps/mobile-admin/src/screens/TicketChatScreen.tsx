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
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/AuthContext';
import { api, Ticket, ApiError } from '@/lib/api';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { colors, fontFamily, radius, spacing } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

type ChatRoute = RouteProp<RootStackParamList, 'TicketChat'>;

const QUICK_RESPONSES = [
  'Investigating this issue now.',
  'Your payment slip has been verified.',
  'Please restart your container from console.',
  'The DNS record has been updated.',
  'Issue has been resolved successfully.',
];

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
      setError(err.message || 'Failed to load conversation');
    }
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSend(textToSend?: string) {
    const body = (textToSend || draft).trim();
    if (!body) return;
    setDraft('');
    setSending(true);
    try {
      await api.tickets.reply(ticketId, body);
      await load();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
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
      Alert.alert('Success', 'Ticket returned to unassigned queue.');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Failed to unclaim ticket');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReopen() {
    setBusyAction('reopen');
    try {
      await api.tickets.updateStatus(ticketId, 'open');
      Alert.alert('Success', 'Ticket reopened.');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Failed to reopen ticket');
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
      Alert.alert('Success', 'Ticket marked resolved and archived.');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Failed to close ticket');
    } finally {
      setBusyAction(null);
    }
  }

  const messages = ticket?.messages ?? [];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bgBase }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {subject}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {ticket && <Badge status={ticket.status} />}
            <Text style={styles.headerCustomer} numberOfLines={1}>
              {ticket?.user?.displayName ? `${ticket.user.displayName} · ${ticket.user.email}` : (ticket?.user?.email ?? '')}
            </Text>
          </View>
        </View>
      </View>

      {/* Staff Actions Bar */}
      {ticket && ticket.status !== 'closed' ? (
        <View style={styles.staffActionBar}>
          <Button
            label="Claim"
            icon={<Ionicons name="person-add-outline" size={13} color={colors.onSurface} />}
            variant="glass"
            size="sm"
            onPress={handleClaim}
            loading={busyAction === 'claim'}
            style={{ flex: 1 }}
          />
          <Button
            label="Unclaim"
            icon={<Ionicons name="person-remove-outline" size={13} color={colors.onSurface} />}
            variant="glass"
            size="sm"
            onPress={handleUnclaim}
            loading={busyAction === 'unclaim'}
            style={{ flex: 1 }}
          />
          <Button
            label="Resolve"
            icon={<Ionicons name="checkmark-done-circle-outline" size={14} color="#ffffff" />}
            variant="danger"
            size="sm"
            onPress={() => {
              setCloseReason('Resolved by support staff via mobile admin');
              setCloseModalVisible(true);
            }}
            loading={busyAction === 'close'}
            style={{ flex: 1.1 }}
          />
        </View>
      ) : ticket?.status === 'closed' ? (
        <View style={styles.closedBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="lock-closed" size={14} color={colors.muted} />
            <Text style={styles.closedBannerText}>This ticket is resolved and closed.</Text>
          </View>
          <Pressable onPress={handleReopen} style={styles.reopenBtn}>
            <Ionicons name="refresh-outline" size={13} color={colors.primary} />
            <Text style={styles.reopenBtnText}>Reopen</Text>
          </Pressable>
        </View>
      ) : null}

      {error && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(239,68,68,0.1)', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="alert-circle" size={15} color={colors.error} />
          <Text style={{ color: colors.error, fontSize: 12, flex: 1 }}>{error}</Text>
        </View>
      )}

      {/* Message History List */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 20 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: colors.muted, fontFamily: fontFamily.body, fontSize: 13 }}>
              No messages recorded in this ticket yet.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isStaff = item.senderRole === 'admin' || item.senderRole === 'support' || item.senderRole === 'dev';
          return (
            <View style={[styles.bubbleRow, isStaff && { justifyContent: 'flex-end' }]}>
              <View style={[styles.bubble, isStaff ? styles.bubbleMine : styles.bubbleTheirs]}>
                <View style={styles.bubbleHeader}>
                  <Text style={[styles.bubbleSender, isStaff ? styles.bubbleSenderMine : styles.bubbleSenderTheirs]}>
                    {item.sender?.displayName || item.sender?.email || (isStaff ? 'Staff Support' : 'Customer')}
                  </Text>
                  {isStaff && (
                    <View style={styles.staffTag}>
                      <Text style={styles.staffTagText}>STAFF</Text>
                    </View>
                  )}
                </View>
                <Text selectable style={[styles.bubbleText, isStaff ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
                  {item.body}
                </Text>
                <Text style={[styles.bubbleTime, isStaff ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Quick Reply Chips Bar */}
      {ticket && ticket.status !== 'closed' && (
        <View style={styles.quickRepliesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {QUICK_RESPONSES.map((chip, idx) => (
              <Pressable key={idx} style={styles.quickReplyChip} onPress={() => handleSend(chip)}>
                <Ionicons name="flash" size={11} color={colors.primary} />
                <Text style={styles.quickReplyText}>{chip}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Reply Input Bar */}
      {ticket && ticket.status !== 'closed' && (
        <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type your response to the customer..."
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
          />
          <Pressable
            onPress={() => handleSend()}
            disabled={sending || !draft.trim()}
            style={[styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.5 }]}
          >
            {sending ? (
              <Text style={styles.sendBtnText}>...</Text>
            ) : (
              <Ionicons name="send" size={15} color="#ffffff" />
            )}
          </Pressable>
        </View>
      )}

      {/* Close Ticket Reason Modal */}
      <Modal visible={closeModalVisible} transparent animationType="fade" onRequestClose={() => setCloseModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Resolve & Close Ticket</Text>
            <Text style={styles.modalSubtitle}>
              Document the closure resolution summary for customer record:
            </Text>
            <TextInput
              value={closeReason}
              onChangeText={setCloseReason}
              placeholder="e.g. Issue investigated, container restart verified"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              style={styles.modalTextarea}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button label="Cancel" variant="glass" size="sm" onPress={() => setCloseModalVisible(false)} style={{ flex: 1 }} />
              <Button
                label="Confirm Resolution"
                variant="danger"
                size="sm"
                onPress={handleConfirmClose}
                loading={busyAction === 'close'}
                disabled={!closeReason.trim()}
                style={{ flex: 1.2 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
    backgroundColor: colors.bgBase,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: { fontFamily: fontFamily.headSemibold, fontSize: 15, color: colors.onSurface, marginBottom: 2 },
  headerCustomer: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted },
  staffActionBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  closedBannerText: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.muted },
  reopenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99,102,241,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.4)',
  },
  reopenBtnText: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: colors.primary },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '84%', borderRadius: radius.md, padding: 12 },
  bubbleTheirs: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderBottomLeftRadius: 4,
  },
  bubbleMine: {
    backgroundColor: '#4f46e5',
    borderBottomRightRadius: 4,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  bubbleSender: { fontFamily: fontFamily.headSemibold, fontSize: 11 },
  bubbleSenderTheirs: { color: colors.primary },
  bubbleSenderMine: { color: '#ffffff' },
  staffTag: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 6 },
  staffTagText: { fontFamily: fontFamily.headSemibold, fontSize: 8, color: '#ffffff' },
  bubbleText: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  bubbleTextTheirs: { color: colors.onSurface },
  bubbleTextMine: { color: '#ffffff' },
  bubbleTime: { fontFamily: fontFamily.body, fontSize: 9, marginTop: 6, textAlign: 'right' },
  bubbleTimeTheirs: { color: colors.muted },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  quickRepliesContainer: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  quickReplyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.25)',
  },
  quickReplyText: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: colors.primary },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    backgroundColor: colors.bgBase,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: colors.onSurface,
    fontFamily: fontFamily.body,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendBtn: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#ffffff',
    fontFamily: fontFamily.headSemibold,
    fontSize: 13,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.bgScreen2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, padding: 20 },
  modalTitle: { fontFamily: fontFamily.headSemibold, fontSize: 16, color: colors.onSurface },
  modalSubtitle: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 17 },
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
