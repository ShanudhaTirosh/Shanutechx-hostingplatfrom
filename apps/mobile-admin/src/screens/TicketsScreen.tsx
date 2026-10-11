import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable, TextInput } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/GlassCard';
import { Badge } from '@/components/Badge';
import { api, Ticket } from '@/lib/api';
import { colors, fontFamily, radius, spacing } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

const FILTERS: Array<{ label: string; value: string | undefined }> = [
  { label: 'Open', value: 'open' },
  { label: 'Pending', value: 'pending' },
  { label: 'Closed', value: 'closed' },
  { label: 'All', value: undefined },
];

const PRIORITY_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  high: { bg: 'rgba(239,68,68,0.15)', text: colors.error, border: 'rgba(239,68,68,0.3)' },
  medium: { bg: 'rgba(245,158,11,0.15)', text: colors.warning, border: 'rgba(245,158,11,0.3)' },
  low: { bg: 'rgba(148,142,156,0.15)', text: colors.muted, border: 'rgba(148,142,156,0.2)' },
};

export function TicketsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [filter, setFilter] = useState<string | undefined>('open');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: string | undefined) => {
    try {
      const { tickets } = await api.tickets.list(status);
      setTickets(tickets);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load tickets');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(filter);
    }, [load, filter])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load(filter);
    setRefreshing(false);
  }

  const visibleTickets = (tickets ?? []).filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.subject.toLowerCase().includes(q) ||
      (t.user?.email && t.user.email.toLowerCase().includes(q)) ||
      (t.user?.displayName && t.user.displayName.toLowerCase().includes(q)) ||
      t.id.toLowerCase().includes(q)
    );
  });

  return (
    <View style={styles.screen}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.title}>Support Desk</Text>
          <Text style={styles.subtitle}>Customer inquiries, incidents & live transcripts</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{tickets?.length ?? 0}</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={15} color={colors.muted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search tickets, subject, or customer..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={colors.muted} style={{ paddingHorizontal: 4 }} />
          </Pressable>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const isActive = filter === f.value;
          return (
            <Pressable
              key={f.label}
              onPress={() => setFilter(f.value)}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
            >
              <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {error && (
        <View style={{ marginHorizontal: 16, marginTop: 10, padding: 12, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="alert-circle" size={14} color={colors.error} />
          <Text style={{ color: colors.error, fontFamily: fontFamily.bodyMedium, fontSize: 12, flex: 1 }}>{error}</Text>
        </View>
      )}

      {/* Ticket List */}
      <FlatList
        data={visibleTickets}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 16, paddingTop: 10, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          !tickets ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={styles.muted}>Loading support queue…</Text>
            </View>
          ) : (
            <GlassCard style={{ padding: 28, alignItems: 'center', marginTop: 16 }}>
              <Ionicons name="ticket-outline" size={34} color={colors.muted} style={{ marginBottom: 8 }} />
              <Text style={[styles.muted, { textAlign: 'center', marginBottom: 4 }]}>
                No tickets in this queue.
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }}>
                All customer inquiries in this category have been addressed.
              </Text>
            </GlassCard>
          )
        }
        renderItem={({ item }) => {
          const prio = PRIORITY_STYLE[item.priority] ?? PRIORITY_STYLE.low;
          const userInitial = (item.user?.displayName || item.user?.email || 'U').charAt(0).toUpperCase();
          const lastMsg = item.messages && item.messages.length > 0 ? item.messages[item.messages.length - 1] : null;

          return (
            <Pressable onPress={() => navigation.navigate('TicketChat', { ticketId: item.id, subject: item.subject })}>
              <GlassCard style={styles.ticketCard}>
                <View style={styles.row}>
                  {/* Customer Avatar Circle */}
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{userInitial}</Text>
                  </View>

                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.subject} numberOfLines={1}>
                      {item.subject}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Ionicons name="person-outline" size={11} color={colors.muted} />
                      <Text style={styles.customer} numberOfLines={1}>
                        {item.user?.displayName ? `${item.user.displayName} (${item.user.email})` : (item.user?.email ?? 'Anonymous')}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.prioBadge, { backgroundColor: prio.bg, borderColor: prio.border }]}>
                    <Text style={[styles.prioText, { color: prio.text }]}>{item.priority.toUpperCase()}</Text>
                  </View>
                </View>

                {lastMsg && (
                  <View style={styles.lastMsgBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 5 }}>
                      <Ionicons name="chatbubble-ellipses-outline" size={12} color={colors.onSurfaceVariant} style={{ marginTop: 2 }} />
                      <Text style={[styles.lastMsgText, { flex: 1 }]} numberOfLines={2}>
                        {lastMsg.body}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.metaRow}>
                  <Badge status={item.status} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="time-outline" size={11} color={colors.muted} />
                    <Text style={styles.date}>
                      {new Date(item.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: { fontFamily: fontFamily.head, fontSize: 22, color: colors.onSurface },
  subtitle: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  countBadge: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
  },
  countText: { fontFamily: fontFamily.headSemibold, fontSize: 13, color: colors.primary },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  searchIcon: { fontSize: 13, marginRight: 8 },
  searchInput: {
    flex: 1,
    height: 44,
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: colors.onSurface,
  },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 6 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  filterPillActive: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  filterLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.muted },
  filterLabelActive: { color: colors.primary },
  muted: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 13 },
  ticketCard: { marginBottom: 12, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { fontFamily: fontFamily.headSemibold, fontSize: 14, color: colors.primary },
  subject: { fontFamily: fontFamily.headSemibold, fontSize: 15, color: colors.onSurface },
  customer: { fontFamily: fontFamily.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  prioBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 6,
    flexShrink: 0,
  },
  prioText: { fontFamily: fontFamily.headSemibold, fontSize: 9, letterSpacing: 0.5 },
  lastMsgBox: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  lastMsgText: { fontFamily: fontFamily.body, fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 17 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  date: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted },
});
