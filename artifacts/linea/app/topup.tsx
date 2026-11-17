import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useBilling } from '@/context/BillingContext';
import { money } from '@/utils/currency';
import { Btn, DemoNote, F, Press, useBottomPad } from '@/components/ui';

export default function TopUp() {
  const c = useColors(), bottom = useBottomPad(false), billing = useBilling();
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const pack = billing.packs.find(p => p.package.identifier === selected);
  return <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: 18, paddingBottom: bottom, gap: 16 }}>
    <Text style={{ fontFamily: F.b, fontSize: 26, color: c.foreground }}>Add credit</Text>
    <Text style={{ fontFamily: F.r, fontSize: 15, color: c.mutedForeground }}>
      Your credit wallet is in GBP. Google’s checkout currency may differ; the credit added is always shown separately.
    </Text>
    <DemoNote text={billing.testMode
      ? 'TEST STORE · No real money. Preview purchases cannot pay for calls, messages or phone numbers. Expo Go does not verify Google Play billing.'
      : billing.readiness?.message ?? 'Checking store availability. Real checkout stays locked until setup is verified.'} />
    {!billing.wallet && <Text style={{ fontFamily: F.r, color: c.mutedForeground }}>
      Customer sign-in is not connected in this app yet. You can explore test checkout, but no personal or spendable wallet credit will be added.
    </Text>}
    {billing.loading && <Text style={{ color: c.mutedForeground }}>Loading store prices…</Text>}
    {billing.packs.map(p => <Press key={p.package.identifier} testID={`credit-pack-${p.creditMinor}`}
      accessibilityRole="radio" accessibilityState={{ checked: selected === p.package.identifier, disabled: billing.busy }}
      disabled={billing.busy} onPress={() => { setSelected(p.package.identifier); setConfirming(false); }}
      style={[styles.pack, { backgroundColor: c.card, borderColor: selected === p.package.identifier ? c.primary : c.border }]}>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={{ fontFamily: F.b, fontSize: 18, color: c.foreground }}>{p.package.product.title}</Text>
        <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>Adds {money(p.creditMinor / 100, p.currency)} {billing.testMode ? 'test credit' : 'credit'}</Text>
      </View>
      <Text style={{ fontFamily: F.b, fontSize: 20, color: c.primary }}>{p.package.product.priceString}</Text>
    </Press>)}
    {!billing.loading && billing.packs.length === 0 && <View style={[styles.empty, { backgroundColor: c.card }]}>
      <Text style={{ color: c.foreground, fontFamily: F.s }}>Credit packs aren’t available yet</Text>
      <Text style={{ color: c.mutedForeground, fontFamily: F.r }}>No prices have been invented. Store offerings must load before checkout can open.</Text>
    </View>}
    {(billing.sdkError || billing.storeError) && <Text accessibilityRole="alert" style={{ color: c.destructive }}>{billing.sdkError || 'Could not load store offerings.'}</Text>}
    {confirming && pack ? <View style={[styles.empty, { backgroundColor: c.card, borderColor: c.primary, borderWidth: 1 }]}>
      <Text style={{ fontFamily: F.b, color: c.foreground }}>{billing.testMode ? 'Confirm test purchase' : 'Continue to Google Play?'}</Text>
      <Text style={{ fontFamily: F.r, color: c.mutedForeground }}>{pack.package.product.priceString} checkout · {money(pack.creditMinor / 100, pack.currency)} {billing.testMode ? 'test credit, not spendable' : 'wallet credit'}</Text>
      <Btn label={billing.busy ? 'Processing…' : billing.testMode ? 'Confirm test purchase' : 'Open Google Play'}
        testID="topup-confirm" disabled={billing.busy} onPress={() => { setConfirming(false); void billing.purchase(pack); }} />
      <Btn label="Cancel" kind="ghost" testID="topup-cancel" disabled={billing.busy} onPress={() => setConfirming(false)} />
    </View> : <Btn label={billing.busy ? 'Processing…' : billing.testMode ? 'Try test purchase' : 'Continue'}
      testID="topup-continue" disabled={!pack || !billing.canPurchase || billing.busy}
      onPress={() => setConfirming(true)} />}
    {!!billing.message && <Text testID="topup-message" accessibilityLiveRegion="polite" style={{ fontFamily: F.r, color: c.foreground }}>{billing.message}</Text>}
    <Btn label={billing.refreshing ? 'Checking…' : 'Check purchases'} kind="ghost" testID="topup-check"
      disabled={billing.refreshing || billing.busy} onPress={() => void billing.refresh()} />
    <Btn label="Reload store options" kind="ghost" testID="topup-reload" disabled={billing.busy} onPress={billing.reloadStore} />
    <Btn label="View country rates" testID="topup-rates" kind="ghost" onPress={() => router.push('/settings/rates')} />
  </ScrollView>;
}
const styles = StyleSheet.create({
  pack: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: 14, borderWidth: 1 },
  empty: { padding: 18, borderRadius: 14, gap: 12 },
});
