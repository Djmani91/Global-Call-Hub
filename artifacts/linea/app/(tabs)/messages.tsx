import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { contactByNumber, when } from '@/data/demo';
import { Avatar, EmptyState, F, IconButton, Press, ScreenHeader, SearchBar, tap, useBottomPad } from '@/components/ui';

export default function Messages() {
  const c = useColors();
  const { threads, prefs } = useApp();
  const [q, setQ] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const bottom = useBottomPad();

  const list = useMemo(() => threads
    .filter((t) => !unreadOnly || t.unread)
    .filter((t) => {
      const s = q.toLowerCase();
      if (!s) return true;
      const name = contactByNumber(t.number)?.name ?? '';
      return name.toLowerCase().includes(s) || t.number.includes(s) || t.messages.some((m) => m.text.toLowerCase().includes(s));
    })
    .sort((a, b) => (b.messages.at(-1)?.at ?? 0) - (a.messages.at(-1)?.at ?? 0)), [threads, q, unreadOnly]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Messages" right={<IconButton name="edit" label="Compose" testID="messages-compose" onPress={() => router.push('/compose')} />} />
      <SearchBar value={q} onChange={setQ} testID="messages-search"
        right={<Press testID="messages-filter-unread" onPress={() => { tap('select'); setUnreadOnly((v) => !v); }} haptic={false} accessibilityLabel="Show unread only"
          style={[styles.filter, unreadOnly && { backgroundColor: c.accent }]}>
          <Feather name="filter" size={20} color={unreadOnly ? c.primary : c.foreground} />
        </Press>} />
      {unreadOnly ? <Text style={[styles.chip, { color: c.primary }]}>Showing unread only</Text> : null}
      <FlatList
        data={list}
        keyExtractor={(t) => t.id}
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: bottom }}
        ListEmptyComponent={<EmptyState icon="message-circle" title={q || unreadOnly ? 'Nothing here' : 'No conversations'} body="Start a conversation with the compose button. Drafts stay on this device until Twilio is connected." />}
        renderItem={({ item }) => {
          const ct = contactByNumber(item.number);
          const last = item.messages.at(-1);
          const preview = item.draft ? `Draft: ${item.draft}` : last ? `${last.from === 'me' ? 'You: ' : ''}${last.text}` : '';
          return (
            <Press testID={`thread-${item.id}`} scale={0.985} onPress={() => router.push(`/conversation/${item.id}`)} style={[styles.row, prefs.compact && { paddingVertical: 6 }]}>
              <Avatar name={ct?.name ?? item.number} hue={ct?.hue} badge size={prefs.compact ? 36 : 46} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: item.unread ? F.b : F.s, fontSize: 16, color: c.foreground }}>{ct?.name ?? item.number}</Text>
                <View style={{ flexDirection: 'row', marginTop: 3 }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: item.unread ? F.s : F.r, fontSize: 14, color: item.draft ? c.warning : item.unread ? c.foreground : c.mutedForeground }}>{preview}</Text>
                  <Text style={{ fontFamily: item.unread ? F.s : F.r, fontSize: 14, color: item.unread ? c.foreground : c.mutedForeground }}> · {last ? when(last.at, prefs.showSeconds) : ''}</Text>
                </View>
              </View>
              {item.unread ? <View style={[styles.dot, { backgroundColor: c.primary }]} /> : null}
            </Press>
          );
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  filter: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  chip: { fontFamily: F.m, fontSize: 12, paddingHorizontal: 22, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 12 },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
