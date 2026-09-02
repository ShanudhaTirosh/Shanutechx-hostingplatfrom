import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable, TextInput } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/GlassCard';
import { Badge } from '@/components/Badge';
import { api, Ticket } from '@/lib/api';
import { colors, fontFamily, radius } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

const FILTERS: Array<{ label: string; value: string | undefined }> = [
  { label: 'Open', value: 'open' },
  { label: 'Pending', value: 'pending' },
  { label: 'Closed', value: 'closed' },
  { label: 'All', value: undefined },
];

const PRIORITY_STYLE: Record<string, { bg: string; text: string }> = {
  high: { bg: 'rgba(239,68,68,0.15)', text: colors.error },
  medium: { bg: 'rgba(245,158,11,0.15)', text: colors.warning },
  low: { bg: 'rgba(148,142,156,0.15)', text: colors.muted },
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
      setError(err.message);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(filter); }, [load, filter]));

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
      t.id.toLowerCase().includes(q)
    );
  });

  return (
    <View style={styles.screen}>
      <Text style={[styles.title, { paddingTop: insets.top + 12 }]}>Support Tickets</Text>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by subject, customer email…"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.label}
            onPress={() => setFilter(f.value)}
            style={[styles.filterPill, filter === f.value && styles.filterPillActive]}
          >
            <Text style={[styles.filterLabel, filter === f.value && styles.filterLabelActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={visibleTickets}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          !tickets ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : error ? (
            <Text style={{ color: colors.error }}>{error}</Text>
          ) : (
            <GlassCard><Text style={styles.muted}>No tickets found.</Text></GlassCard>
          )
        }
        renderItem={({ item }) => {
          const prio = PRIORITY_STYLE[item.priority] ?? PRIORITY_STYLE.low;
          return (
            <Pressable onPress={() => navigation.navigate('TicketChat', { ticketId: item.id, subject: item.subject })}>
              <GlassCard style={{ marginBottom: 10 }}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
                    <Text style={styles.customer}>{item.user?.email ?? 'Unknown'}</Text>
                  </View>
                  <View style={[styles.prioBadge, { backgroundColor: prio.bg }]}>
                    <Text style={[styles.prioText, { color: prio.text }]}>{item.priority.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.metaRow}>
                  <Badge status={item.status} />
                  <Text style={styles.date}>{new Date(item.updatedAt).toLocaleDateString()}</Text>
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
  title: { fontFamily: fontFamily.head, fontSize: 20, color: colors.onSurface, paddingHorizontal: 20, paddingTop: 0 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 20,
    marginTop: 12,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: {
    flex: 1,
    height: 40,
    fontFamily: fontFamily.body,
    fontSize: 14,
    color: colors.onSurface,
  },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 12, marginBottom: 4 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
  filterPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 12, color: colors.muted },
  filterLabelActive: { color: '#1a0f33' },
  muted: { fontFamily: fontFamily.body, color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 30 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  subject: { fontFamily: fontFamily.bodySemibold, fontSize: 14, color: colors.onSurface },
  customer: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted, marginTop: 2 },
  prioBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginLeft: 8 },
  prioText: { fontFamily: fontFamily.bodyMedium, fontSize: 10 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  date: { fontFamily: fontFamily.body, fontSize: 11, color: colors.muted },
});
