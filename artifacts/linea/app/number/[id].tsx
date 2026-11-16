import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { findCountry, findSample } from '@/data/demo';
import { Btn, CountryMark, EmptyState, F, tap, useBottomPad } from '@/components/ui';

export default function NumberDetail() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { reserved, toggleShortlist } = useApp();
  const [blockedShown, setBlockedShown] = useState(false);
  const bottom = useBottomPad(false);
  const n = findSample(id);
  const ct = findCountry(n?.country);
  if (!n || !ct) return <View style={{ flex: 1, backgroundColor: c.background }}><EmptyState icon="hash" title="Number not found" body="This sample is no longer in the list." /></View>;
  const saved = reserved.includes(n.id);
  const rows: [string, string][] = [
    ['Country', `${ct.name} (${ct.dial})`], ['Type', ct.kind], ['Capabilities', n.sms ? 'Voice and SMS' : 'Voice only'],
    ['Monthly (sample)', `£${n.monthly.toFixed(2)}`], ['Requirements', ct.note],
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
      {blockedShown ? (
        <View testID="number-purchase-blocked" style={[styles.blocked, { backgroundColor: '#3A2024', borderColor: c.destructive }]}>
          <Feather name="lock" size={18} color={c.destructive} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: F.s, color: c.foreground, fontSize: 15 }}>Purchasing is disabled in this demo</Text>
            <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 13, lineHeight: 19 }}>Live number purchases need a connected Twilio account. No order was placed and nothing was charged.</Text>
          </View>
        </View>
      ) : null}
      <Btn label="Buy this number" icon="lock" testID="number-buy" onPress={() => { tap('medium'); setBlockedShown(true); }} />
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
