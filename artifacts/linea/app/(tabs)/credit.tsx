import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { useBilling } from '@/context/BillingContext';
import { CURRENCIES, money } from '@/utils/currency';
import { CountryMark, DemoNote, F, Hero, IconButton, ScreenHeader, Section, useBottomPad } from '@/components/ui';

export default function Credit() {
  const c = useColors();
  const { profile } = useApp();
  const billing = useBilling();
  const currency = CURRENCIES[profile.billingCountry];
  const bottom = useBottomPad();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Credit" right={<IconButton name="plus-circle" label="Top up" testID="credit-add" onPress={() => router.push('/topup')} />} />
      <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
        <View style={styles.balance}>
          <Text style={{ fontFamily: F.m, fontSize: 13, color: c.mutedForeground, letterSpacing: 1 }}>BALANCE</Text>
          <Text testID="credit-balance" style={{ fontFamily: F.b, fontSize: 52, color: c.foreground, letterSpacing: -1.5 }}>{billing.wallet ? money(billing.wallet.balanceMinor / 100, billing.wallet.currency) : '—'}</Text>
          <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>{billing.wallet ? 'Spendable wallet · fixed GBP currency' : billing.walletLoading ? 'Loading wallet…' : 'Sign-in required to view your wallet'}</Text>
          {!!billing.wallet?.testBalanceMinor && <Text style={{ fontFamily: F.r, fontSize: 13, color: c.primary }}>{money(billing.wallet.testBalanceMinor / 100, 'GBP')} test credit · not spendable</Text>}
        </View>
        <Hero title="Buy credit" body="Use credit for calls and messages across borders." cta="See top-up options" testID="credit-buy" onPress={() => router.push('/topup')} />
        <Section label="Credit history" />
        <View style={[styles.card, { backgroundColor: c.card }]}>
          {billing.wallet?.transactions.length ? billing.wallet.transactions.map(t => <View key={t.id} style={{ paddingVertical: 10, gap: 4 }}>
            <Text style={{ fontFamily: F.s, color: c.foreground }}>{t.kind === 'refund' ? 'Purchase refunded' : 'Credit purchase'} · {money(t.amountMinor / 100, 'GBP')}</Text>
            <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 12 }}>{new Date(t.createdAt).toLocaleDateString()} · {t.environment === 'sandbox' ? 'Test only' : 'Google Play'}</Text>
          </View>) : <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 14 }}>{billing.wallet ? 'No verified credit transactions yet.' : 'Your balance and history will be saved securely when customer sign-in is connected.'}</Text>}
          <View style={{ paddingTop: 12 }}><IconButton name="refresh-cw" label="Check purchases" testID="credit-refresh" onPress={() => void billing.refresh()} /></View>
          {!!billing.message && <Text style={{ color: c.mutedForeground, fontFamily: F.r }}>{billing.message}</Text>}
        </View>
        <Section label="Country pricing" />
        <View style={[styles.card, { backgroundColor: c.card, gap: 12 }]}>
          <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 14 }}>Check monthly number, incoming/outgoing call and SMS rates in {currency}.</Text>
          <IconButton name="chevron-right" label="View country rates" testID="credit-all-rates" onPress={() => router.push('/settings/rates')} />
        </View>
        <View style={{ padding: 18 }}><DemoNote text="Rates use current Twilio prices × 3. Rate display follows your billing country; the GBP wallet never changes currency. Test credit cannot buy numbers." /></View>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  balance: { alignItems: 'center', paddingVertical: 18, gap: 2 },
  card: { marginHorizontal: 18, padding: 16, borderRadius: 14 },
  rate: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
