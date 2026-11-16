import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { CURRENCIES, money } from '@/utils/currency';
import { CountryMark, DemoNote, F, Hero, IconButton, ScreenHeader, Section, useBottomPad } from '@/components/ui';

export default function Credit() {
  const c = useColors();
  const { profile } = useApp();
  const currency = CURRENCIES[profile.billingCountry];
  const bottom = useBottomPad();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Credit" right={<IconButton name="plus-circle" label="Top up" testID="credit-add" onPress={() => router.push('/topup')} />} />
      <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
        <View style={styles.balance}>
          <Text style={{ fontFamily: F.m, fontSize: 13, color: c.mutedForeground, letterSpacing: 1 }}>BALANCE</Text>
          <Text testID="credit-balance" style={{ fontFamily: F.b, fontSize: 52, color: c.foreground, letterSpacing: -1.5 }}>{money(0, currency)}</Text>
          <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>Demo balance · no payments are processed</Text>
        </View>
        <Hero title="Buy credit" body="Use credit for calls and messages across borders." cta="See top-up options" testID="credit-buy" onPress={() => router.push('/topup')} />
        <Section label="Recent charges" />
        <View style={[styles.card, { backgroundColor: c.card }]}>
          <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 14 }}>No charges yet. Nothing has been billed on this demo.</Text>
        </View>
        <Section label="Country pricing" />
        <View style={[styles.card, { backgroundColor: c.card, gap: 12 }]}>
          <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 14 }}>Check monthly number, incoming/outgoing call and SMS rates in {currency}.</Text>
          <IconButton name="chevron-right" label="View country rates" testID="credit-all-rates" onPress={() => router.push('/settings/rates')} />
        </View>
        <View style={{ padding: 18 }}><DemoNote text="Rates use current Twilio prices × 3. Credit purchases are not enabled." /></View>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  balance: { alignItems: 'center', paddingVertical: 18, gap: 2 },
  card: { marginHorizontal: 18, padding: 16, borderRadius: 14 },
  rate: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
