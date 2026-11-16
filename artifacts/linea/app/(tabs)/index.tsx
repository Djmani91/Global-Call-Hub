import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { contactByNumber, when } from '@/data/demo';
import { Avatar, DemoNote, EmptyState, F, IconButton, Press, ScreenHeader, SearchBar, confirmAction, tap, useBottomPad } from '@/components/ui';

export default function Calls() {
  const c = useColors();
  const { calls, clearCalls, blocked, prefs } = useApp();
  const compact = prefs.compact;
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'missed'>('all');
  const bottom = useBottomPad();

  const list = useMemo(() => calls.filter((k) => {
    if (filter === 'missed' && k.direction !== 'missed') return false;
    const name = contactByNumber(k.number)?.name ?? '';
    const s = q.toLowerCase();
    return !s || name.toLowerCase().includes(s) || k.number.replace(/\D/g, '').includes(s.replace(/\D/g, '') || '~');
  }), [calls, filter, q]);

  const confirmClear = () => confirmAction('Clear call history?', 'This removes the demo history stored on this device.', 'Clear', clearCalls);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Calls"
        left={calls.length ? <IconButton name="trash-2" label="Clear history" testID="calls-clear" onPress={confirmClear} color={c.mutedForeground} size={21} /> : undefined}
        right={<IconButton name="phone-outgoing" label="Open keypad" testID="calls-new" onPress={() => router.push('/dialer')} />} />
      <SearchBar value={q} onChange={setQ} testID="calls-search" placeholder="Search name or number" />
      <View style={[styles.seg, { backgroundColor: c.ink }]}>
        {(['all', 'missed'] as const).map((f) => (
          <Press key={f} testID={`calls-filter-${f}`} onPress={() => { tap('select'); setFilter(f); }} haptic={false}
            style={[styles.segItem, filter === f && { backgroundColor: c.elevated }]}>
            <Text style={{ fontFamily: F.s, fontSize: 14, color: filter === f ? c.foreground : c.mutedForeground }}>
              {f === 'all' ? 'All' : `Missed (${calls.filter((k) => k.direction === 'missed').length})`}
            </Text>
          </Press>
        ))}
      </View>
      <FlatList
        data={list}
        keyExtractor={(k) => k.id}
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: bottom + 80 }}
        ListHeaderComponent={<View style={{ paddingHorizontal: 18, paddingBottom: 6 }}><DemoNote text="Demo history. Twilio is not connected yet, so no real calls are placed or received." /></View>}
        ListEmptyComponent={<EmptyState icon={filter === 'missed' ? 'phone-missed' : 'phone'} title={q ? 'No matches' : filter === 'missed' ? 'No missed calls' : 'No calls yet'} body={q ? 'Try a different name or a few digits of the number.' : 'Your call history will collect here once a line is connected.'} />}
        renderItem={({ item }) => {
          const ct = contactByNumber(item.number);
          const missed = item.direction === 'missed';
          return (
            <Press testID={`call-row-${item.id}`} scale={0.985} onPress={() => router.push({ pathname: '/call', params: { number: item.number } })} style={[styles.row, compact && { paddingVertical: 6 }]}>
              <Avatar name={ct?.name ?? item.number} hue={ct?.hue} size={compact ? 36 : 46} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: F.s, fontSize: 16, color: missed ? c.destructive : c.foreground }}>{ct?.name ?? item.number}</Text>
                <View style={styles.meta}>
                  <Feather name={missed ? 'phone-missed' : item.direction === 'in' ? 'phone-incoming' : 'phone-outgoing'} size={13} color={missed ? c.destructive : c.mutedForeground} />
                  <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>
                    {missed ? 'Missed' : item.direction === 'in' ? 'Incoming' : 'Outgoing'}{item.duration ? ` · ${item.duration}` : ''}{blocked.includes(item.number) ? ' · Blocked' : ''}
                  </Text>
                </View>
              </View>
              <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>{when(item.at, prefs.showSeconds)}</Text>
              <Feather name="info" size={18} color={c.mutedForeground} />
            </Press>
          );
        }}
      />
      <Press testID="calls-fab-keypad" onPress={() => router.push('/dialer')} accessibilityLabel="Open keypad"
        style={[styles.fab, { backgroundColor: c.primary, bottom: bottom - 6 }]}>
        <Feather name="grid" size={24} color={c.primaryForeground} />
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', marginHorizontal: 18, borderRadius: 22, padding: 4, marginBottom: 12 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 11 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  fab: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
});
