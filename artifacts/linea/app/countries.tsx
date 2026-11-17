import React, { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getGetTwilioAvailableNumberCountriesQueryKey, useGetTwilioAvailableNumberCountries } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { countryFromTwilio } from '@/data/demo';
import { CountryMark, EmptyState, F, Press, SearchBar, useBottomPad } from '@/components/ui';

export default function Countries() {
  const c = useColors();
  const [q, setQ] = useState('');
  const bottom = useBottomPad(false);
  const countriesQuery = useGetTwilioAvailableNumberCountries({ query: {
    queryKey: getGetTwilioAvailableNumberCountriesQueryKey(),
    staleTime: 5 * 60_000,
    retry: 1,
  } });
  const list = (countriesQuery.data?.countries ?? []).map(countryFromTwilio)
    .filter((x) => x.name.toLowerCase().includes(q.toLowerCase()) || x.code.toLowerCase().includes(q.toLowerCase()));
  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: 10 }}>
      <SearchBar value={q} onChange={setQ} testID="countries-search" placeholder="Search country or code" />
      {countriesQuery.isLoading ? <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} /> : null}
      {countriesQuery.isError ? (
        <Press testID="retry-number-countries" onPress={() => countriesQuery.refetch()} style={[styles.error, { backgroundColor: c.card }]}>
          <Text style={{ fontFamily: F.s, color: c.foreground }}>Couldn’t load available countries. Tap to retry.</Text>
        </Press>
      ) : null}
      <FlatList
        data={list}
        keyExtractor={(x) => x.code}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: bottom }}
        ListEmptyComponent={countriesQuery.isLoading || countriesQuery.isError ? undefined : <EmptyState icon="globe" title="No country found" body="No matching country currently appears in your Twilio number catalog." />}
        ListFooterComponent={<Text style={[styles.foot, { color: c.mutedForeground }]}>Showing countries currently listed in your Twilio account. The next screen shows only SMS-capable numbers; availability and requirements vary.</Text>}
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
  error: { marginHorizontal: 18, marginTop: 12, padding: 14, borderRadius: 12 },
});
