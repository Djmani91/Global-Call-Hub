import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { getGetTwilioPricingQueryKey, useGetTwilioPricing } from '@workspace/api-client-react';
import type { CountryPricing, TwilioCountryCode, TwilioPhoneNumberType } from '@workspace/api-client-react';
import { useApp } from '@/context/AppContext';
import { COUNTRIES, findCountry } from '@/data/demo';
import { useColors } from '@/hooks/useColors';
import { Btn, CountryMark, DemoNote, F, Press } from './ui';
import { CURRENCIES, money } from '@/utils/currency';

export function BillingCountry() {
  const c = useColors();
  const { profile, setProfile } = useApp();
  return <View style={{ gap: 12 }}>
    <Text style={{ fontFamily: F.b, fontSize: 20, color: c.foreground }}>Billing country</Text>
    <Text style={{ fontFamily: F.r, fontSize: 14, color: c.mutedForeground }}>
      Saved on this device. This sets your display currency, not the country of your phone number.
    </Text>
    <View style={styles.chips}>{COUNTRIES.map(ct => {
      const active = profile.billingCountry === ct.code;
      return <Press key={ct.code} testID={`billing-country-${ct.code}`}
        accessibilityRole="radio" accessibilityState={{ selected: active }}
        onPress={() => setProfile({ ...profile, billingCountry: ct.code })}
        style={[styles.chip, { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.accent : c.card }]}>
        <CountryMark country={ct} size={22} />
        <Text style={{ fontFamily: F.m, color: c.foreground, fontSize: 13 }}>{ct.name} · {CURRENCIES[ct.code]}</Text>
      </Press>;
    })}</View>
    <DemoNote text="Prices are previews only. No payment method is stored and no charge or number purchase can be made." />
  </View>;
}

export function PricingSummary({ pricing, numberType }: { pricing: CountryPricing; numberType: TwilioPhoneNumberType }) {
  const c = useColors();
  const section = pricing.sections.find(s => s.kind === 'numbers');
  const rate = section?.rates.find(r => r.numberType.toLowerCase().replace(/[^a-z]/g, '') === numberType.replace(/[^a-z]/g, ''));
  return <Text testID="number-rental-price" style={{ fontFamily: F.s, color: rate ? c.primary : c.mutedForeground, fontSize: 13 }}>
    {rate ? `${money(rate.amount, pricing.currency)} ${pricing.currency}/month` : 'Monthly price unavailable'}
  </Text>;
}

const SIMPLE_RATES = [
  { id: 'make-calls', kind: 'voice', direction: 'outgoing', label: 'Make calls', unit: '/min' },
  { id: 'receive-calls', kind: 'voice', direction: 'incoming', label: 'Receive calls', unit: '/min' },
  { id: 'send-sms', kind: 'sms', direction: 'outgoing', label: 'Send SMS', unit: '/segment' },
  { id: 'receive-sms', kind: 'sms', direction: 'incoming', label: 'Receive SMS', unit: '/segment' },
] as const;

function priceRange(amounts: number[], currency: string, unit: string): string {
  if (!amounts.length) return 'Unavailable';
  const low = Math.min(...amounts);
  const high = Math.max(...amounts);
  const range = low === high
    ? money(low, currency, true)
    : `${money(low, currency, true)}–${money(high, currency, true)}`;
  return `${range} ${unit}`;
}

function UsageOverview({ pricing }: { pricing: CountryPricing }) {
  const c = useColors();
  const sectionFor = (kind: 'voice' | 'sms') => pricing.sections.find(section => section.kind === kind);
  const amountFor = (id: string) => {
    const group = SIMPLE_RATES.find(rate => rate.id === id)!;
    const section = sectionFor(group.kind);
    if (!section || section.error) return 'Unavailable';
    return priceRange(section.rates.filter(rate => rate.direction === group.direction).map(rate => rate.amount), pricing.currency, group.unit);
  };
  const numberSection = pricing.sections.find(section => section.kind === 'numbers');
  const rentals = numberSection && !numberSection.error
    ? numberSection.rates.map(rate => `${rate.numberType}: ${money(rate.amount, pricing.currency)}/mo`)
    : [];
  const rentalText = rentals.length ? rentals.slice(0, 3).join(' · ') : 'Unavailable';
  return <View testID="usage-rates-overview" style={[styles.section, { backgroundColor: c.card }]}>
    {SIMPLE_RATES.map(group => (
      <View key={group.id} testID={`usage-summary-${group.id}`} style={styles.simpleRate}>
        <Text style={{ fontFamily: F.m, color: c.foreground, fontSize: 14 }}>{group.label}</Text>
        <Text style={{ fontFamily: F.b, color: c.primary, fontSize: 14, textAlign: 'right', flexShrink: 1 }}>
          {amountFor(group.id)}
        </Text>
      </View>
    ))}
    <View testID="usage-summary-rental" style={[styles.simpleRental, { borderTopColor: c.border }]}>
      <Text style={{ fontFamily: F.m, color: c.foreground, fontSize: 13 }}>Number rental / month</Text>
      <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 12, textAlign: 'right', flex: 1 }}>{rentalText}</Text>
    </View>
    <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 12 }}>
      Prices include 3× markup. Calls are per minute; SMS is per segment. Actual rates vary by destination.
    </Text>
  </View>;
}

export function PricingDetails({ initialCountry = 'US' }: { initialCountry?: string }) {
  const c = useColors();
  const { profile, ready } = useApp();
  const [country, setCountry] = useState(initialCountry as TwilioCountryCode);
  const params = { countryCode: country, billingCountry: profile.billingCountry as TwilioCountryCode };
  const query = useGetTwilioPricing(params, { query: {
    queryKey: getGetTwilioPricingQueryKey(params), enabled: ready, staleTime: 60_000, retry: false,
  } });
  const data = query.data;
  return <View style={{ gap: 12 }}>
    <Text style={{ fontFamily: F.b, fontSize: 21, color: c.foreground }}>Country rates</Text>
    <Text style={{ fontFamily: F.r, fontSize: 14, color: c.mutedForeground }}>Select a country to see its basic rates.</Text>
    <View style={styles.chips}>{COUNTRIES.map(ct => <Press key={ct.code}
      testID={`rates-country-${ct.code}`} onPress={() => setCountry(ct.code as TwilioCountryCode)}
      accessibilityRole="radio" accessibilityState={{ selected: country === ct.code }}
      style={[styles.chip, { backgroundColor: country === ct.code ? c.accent : c.card, borderColor: country === ct.code ? c.primary : c.border }]}>
      <CountryMark country={ct} size={22} />
      <Text style={{ fontFamily: F.m, fontSize: 13, color: c.foreground }}>{ct.name}</Text>
    </Press>)}</View>
    <Text testID="rates-billing-currency" style={{ fontFamily: F.s, color: c.primary, fontSize: 14 }}>
      Display: {CURRENCIES[profile.billingCountry] ?? 'Unknown currency'} · Billing: {findCountry(profile.billingCountry)?.name ?? profile.billingCountry}
    </Text>
    <Btn label="Change billing country" testID="rates-change-billing" kind="ghost" onPress={() => router.push('/settings/billing')} />
    {data && !query.isError ? <UsageOverview pricing={data} /> : null}
    {query.isLoading || !ready ? <ActivityIndicator color={c.primary} /> : query.isError ?
      <Text style={{ fontFamily: F.r, color: c.destructive }}>{query.error instanceof Error ? query.error.message : 'Unable to load pricing.'}</Text> :
      null}
    <Btn label="Refresh rates" icon="refresh-cw" testID="pricing-refresh" kind="ghost" onPress={() => query.refetch()} />
  </View>;
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 9 },
  section: { padding: 16, borderRadius: 14, gap: 12 },
  rate: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 5 },
  simpleRate: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  simpleRental: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
