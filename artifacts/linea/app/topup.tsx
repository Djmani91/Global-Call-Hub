import React from 'react';
import { ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { CURRENCIES } from '@/utils/currency';
import { Btn, DemoNote, F, useBottomPad } from '@/components/ui';

export default function TopUp() {
  const c = useColors();
  const { profile } = useApp();
  const bottom = useBottomPad(false);
  return <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: 18, paddingBottom: bottom, gap: 16 }}>
    <Text style={{ fontFamily: F.b, fontSize: 24, color: c.foreground }}>Credit top-ups</Text>
    <Text style={{ fontFamily: F.r, fontSize: 15, color: c.mutedForeground }}>Your billing currency is {CURRENCIES[profile.billingCountry]}.</Text>
    <DemoNote text="Top-ups are not configured. Twilio publishes usage costs, not Linea credit packs. No sample bundles or minute estimates are offered as real prices." />
    <Btn label="Top-ups unavailable" testID="topup-continue" disabled onPress={() => {}} />
    <Btn label="View country rates" testID="topup-rates" kind="ghost" onPress={() => router.push('/settings/rates')} />
  </ScrollView>;
}
