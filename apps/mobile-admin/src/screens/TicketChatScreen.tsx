import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/AuthContext';
import { api, TicketMessage, Ticket } from '@/lib/api';
import { Badge } from '@/components/Badge';
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
      setDraft(body); // put it back so nothing is lost
    } finally {
      setSending(false);
    }
  }

  async function handleStatusChange(status: Ticket['status']) {
    try {
      await api.tickets.updateStatus(ticketId, status);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const messages = ticket?.messages ?? [];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bgBase }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ color: colors.onSurface, fontSize: 18 }}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{subject}</Text>
          {ticket && <Badge status={ticket.status} />}
        </View>
      </View>

      {ticket && (
        <View style={styles.statusRow}>
          {(['open', 'pending', 'closed'] as const).map((s) => (
            <Pressable key={s} onPress={() => handleStatusChange(s)} style={[styles.statusPill, ticket.status === s && styles.statusPillActive]}>
              <Text style={[styles.statusPillLabel, ticket.status === s && styles.statusPillLabelActive]}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {error && <Text style={{ color: colors.error, paddingHorizontal: 20, fontSize: 12 }}>{error}</Text>}

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
                <Text style={[styles.bubbleText, isMine && { color: '#1a0f33' }]}>{item.body}</Text>
                <Text style={[styles.bubbleTime, isMine && { color: 'rgba(26,15,51,0.6)' }]}>
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          );
        }}
      />

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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass },
  headerTitle: { fontFamily: fontFamily.bodySemibold, fontSize: 15, color: colors.onSurface, marginBottom: 4 },
  statusRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
  statusPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusPillLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: colors.muted, textTransform: 'capitalize' },
  statusPillLabelActive: { color: '#1a0f33' },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '80%', borderRadius: radius.md, padding: 12 },
  bubbleTheirs: { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleText: { fontFamily: fontFamily.body, fontSize: 14, color: colors.onSurface, lineHeight: 20 },
  bubbleTime: { fontFamily: fontFamily.body, fontSize: 9, color: colors.muted, marginTop: 6, textAlign: 'right' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.glassBorder },
  input: { flex: 1, maxHeight: 100, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: 'rgba(255,255,255,0.04)', color: colors.onSurface, fontFamily: fontFamily.body, fontSize: 14, padding: 12 },
  sendBtn: { height: 42, paddingHorizontal: 18, borderRadius: radius.sm, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
