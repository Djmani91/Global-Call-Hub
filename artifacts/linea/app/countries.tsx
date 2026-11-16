import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { COUNTRIES } from '@/data/demo';
import { CountryMark, EmptyState, F, Press, SearchBar, useBottomPad } from '@/components/ui';

export default function Countries() {
  const c = useColors();
  const [q, setQ] = useState('');
  const bottom = useBottomPad(false);
  const list = COUNTRIES.filter((x) => x.name.toLowerCase().includes(q.toLowerCase()) || x.dial.includes(q));
  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: 10 }}>
      <SearchBar value={q} onChange={setQ} testID="countries-search" placeholder="Search country or code" />
      <FlatList
        data={list}
        keyExtractor={(x) => x.code}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: bottom }}
        ListEmptyComponent={<EmptyState icon="globe" title="No country found" body="Search the countries supported by this preview." />}
        ListFooterComponent={<Text style={[styles.foot, { color: c.mutedForeground }]}>Availability and regulatory requirements are subject to Twilio and local regulators.</Text>}
        renderItem={({ item }) => (
          <Press testID={`country-${item.code}`} scale={0.985} onPress={() => router.push(`/numbers/${item.code}`)} style={[styles.row, { borderBottomColor: c.border }]}>
            <CountryMark country={item} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontFamily: F.s, fontSize: 16, color: c.foreground }}>{item.name}</Text>
                {item.local ? <Text style={[styles.tag, { backgroundColor: c.primary, color: c.primaryForeground }]}>LOCAL</Text> : null}
              </View>
              <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground, marginTop: 2 }}>{item.kind}</Text>
            </View>
            <Text style={{ fontFamily: F.b, fontSize: 16, color: c.foreground }}>{item.dial}</Text>
            <Feather name="chevron-right" size={20} color={c.mutedForeground} />
          </Press>
        )}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 18, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  tag: { fontFamily: F.b, fontSize: 10, letterSpacing: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  foot: { fontFamily: F.r, fontSize: 12, textAlign: 'center', padding: 24, lineHeight: 18 },
});
