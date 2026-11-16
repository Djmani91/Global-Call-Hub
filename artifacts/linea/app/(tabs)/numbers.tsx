import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { findCountry, findSample } from '@/data/demo';
import { CountryMark, DemoNote, F, Hero, IconButton, Press, ScreenHeader, Section, useBottomPad } from '@/components/ui';

export default function Numbers() {
  const c = useColors();
  const { reserved, toggleShortlist } = useApp();
  const bottom = useBottomPad();
  const saved = reserved.map(findSample).filter((n): n is NonNullable<typeof n> => !!n);
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Phone numbers" right={<IconButton name="plus-circle" label="Browse numbers" testID="numbers-add" onPress={() => router.push('/countries')} />} />
      <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
        <Hero title="Get a second number" body="A local line in the country you love, alongside the one you already have." cta="Browse countries" testID="numbers-browse" onPress={() => router.push('/countries')} />
        <Section label="Your numbers" />
        <View style={[styles.empty, { borderColor: c.border }]}>
          <Feather name="smartphone" size={22} color={c.mutedForeground} />
          <Text style={{ flex: 1, fontFamily: F.r, color: c.mutedForeground, fontSize: 14 }}>No number assigned yet. Live numbers become available once Twilio is connected.</Text>
        </View>
        <Section label={`Shortlist${saved.length ? ` (${saved.length})` : ''}`} />
        {saved.length === 0 ? (
          <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 14, paddingHorizontal: 18 }}>Save sample numbers you like to compare them later.</Text>
        ) : saved.map((n) => {
          const ct = findCountry(n.country)!;
          return (
            <Press key={n.id} testID={`shortlist-${n.id}`} onPress={() => router.push(`/number/${n.id}`)} style={[styles.row, { backgroundColor: c.card }]}>
              <CountryMark country={ct} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.s, fontSize: 16, color: c.foreground }}>{n.display}</Text>
                <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>{ct.name} · sample £{n.monthly.toFixed(2)}/mo</Text>
              </View>
              <IconButton name="x" label="Remove from shortlist" testID={`shortlist-remove-${n.id}`} color={c.mutedForeground} size={18} onPress={() => toggleShortlist(n.id)} />
            </Press>
          );
        })}
        <View style={{ padding: 18 }}>
          <DemoNote text="Numbers shown in Linea are illustrative samples, not live inventory. Availability and regulatory requirements are subject to Twilio and each country's rules." />
        </View>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  empty: { flexDirection: 'row', gap: 14, alignItems: 'center', marginHorizontal: 18, padding: 16, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 18, marginBottom: 8, padding: 14, borderRadius: 14 },
});
