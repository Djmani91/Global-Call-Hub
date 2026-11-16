import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { findCountry, findSample } from '@/data/demo';
import { Btn, CountryMark, DemoNote, EmptyState, F, useBottomPad } from '@/components/ui';

export default function NumberDetail() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { reserved, toggleShortlist } = useApp();
  const bottom = useBottomPad(false);
  const n = findSample(id);
  const ct = findCountry(n?.country);
  if (!n || !ct) return <View style={{ flex: 1, backgroundColor: c.background }}><EmptyState icon="hash" title="Number not found" body="This sample is no longer in the list." /></View>;
  const saved = reserved.includes(n.id);
  const rows: [string, string][] = [
    ['Country', `${ct.name} (${ct.dial})`], ['Type', ct.kind], ['Capabilities', n.sms ? 'Voice and SMS' : 'Voice only'],
    ['Monthly', 'See live country rates; sample not priced'], ['Requirements', ct.note],
  ];
  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: 18, paddingBottom: bottom, gap: 12 }}>
      <View style={[styles.hero, { backgroundColor: c.card }]}>
        <CountryMark country={ct} size={44} />
        <Text style={{ fontFamily: F.b, fontSize: 28, color: c.foreground, letterSpacing: 0.5, marginTop: 14 }}>{n.display}</Text>
        <Text style={[styles.sample, { color: c.warning, borderColor: c.warning }]}>SAMPLE NUMBER</Text>
      </View>
      <View style={[styles.table, { backgroundColor: c.card }]}>
        {rows.map(([k, v], i) => (
          <View key={k} style={[styles.tr, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
            <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 14, width: 120 }}>{k}</Text>
            <Text style={{ flex: 1, fontFamily: F.m, color: c.foreground, fontSize: 14, textAlign: 'right' }}>{v}</Text>
          </View>
        ))}
      </View>
      <DemoNote text="This is a saved sample, not an available number or priced offer. No number has been ordered or charged." />
      <Btn label="Purchases unavailable" icon="lock" testID="number-buy" disabled onPress={() => {}} />
      <Btn label="View live country rates" testID="sample-number-rates" kind="ghost"
        onPress={() => router.push({ pathname: '/settings/[section]', params: { section: 'rates', country: ct.code } })} />
      <Btn label={saved ? 'Remove from shortlist' : 'Save to shortlist'} icon="bookmark" kind="ghost" testID="number-shortlist" onPress={() => toggleShortlist(n.id)} />
      <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>Availability and regulatory requirements are subject to Twilio.</Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  hero: { alignItems: 'center', padding: 24, borderRadius: 18 },
  sample: { fontFamily: F.b, fontSize: 11, letterSpacing: 1.5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, marginTop: 10 },
  table: { borderRadius: 14, paddingHorizontal: 16 },
  tr: { flexDirection: 'row', gap: 12, paddingVertical: 14 },
  blocked: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
});
