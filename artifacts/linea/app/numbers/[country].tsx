import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { findCountry, sampleNumbers } from '@/data/demo';
import { CountryMark, DemoNote, EmptyState, F, Press, useBottomPad } from '@/components/ui';

export default function CountryNumbers() {
  const c = useColors();
  const { country } = useLocalSearchParams<{ country: string }>();
  const { reserved } = useApp();
  const ct = findCountry(country);
  const bottom = useBottomPad(false);
  if (!ct) return <View style={{ flex: 1, backgroundColor: c.background }}><EmptyState icon="globe" title="Unknown country" body="Go back and pick a country from the list." /></View>;
  const list = sampleNumbers(ct.code);
  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: 18, paddingBottom: bottom, gap: 10 }}>
      <Stack.Screen options={{ title: ct.name }} />
      <View style={styles.head}>
        <CountryMark country={ct} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.b, fontSize: 20, color: c.foreground }}>{ct.name} {ct.dial}</Text>
          <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>{ct.kind} · {ct.note}</Text>
        </View>
      </View>
      <DemoNote text="Sample numbers for illustration only. These are not live stock and cannot be purchased yet." />
      {list.map((n) => (
        <Press key={n.id} testID={`sample-${n.id}`} onPress={() => router.push(`/number/${n.id}`)} style={[styles.row, { backgroundColor: c.card }]} scale={0.98}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.s, fontSize: 18, color: c.foreground, letterSpacing: 0.3 }}>{n.display}</Text>
            <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground, marginTop: 3 }}>
              {n.voice ? 'Voice' : ''}{n.sms ? ' · SMS' : ' · Voice only'} · sample £{n.monthly.toFixed(2)}/mo
            </Text>
          </View>
          {reserved.includes(n.id) ? <Feather name="bookmark" size={18} color={c.primary} /> : null}
          <Feather name="chevron-right" size={20} color={c.mutedForeground} />
        </Press>
      ))}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14 },
});
