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

const TITLES = { numbers: 'Monthly numbers', voice: 'Voice calls', sms: 'SMS messages' };
export function PricingDetails({ initialCountry = 'US' }: { initialCountry?: string }) {
  const c = useColors();
  const { profile, ready } = useApp();
  const [country, setCountry] = useState(initialCountry as TwilioCountryCode);
  const [expanded, setExpanded] = useState<string[]>([]);
  const params = { countryCode: country, billingCountry: profile.billingCountry as TwilioCountryCode };
  const query = useGetTwilioPricing(params, { query: {
    queryKey: getGetTwilioPricingQueryKey(params), enabled: ready, staleTime: 60_000, retry: false,
  } });
  const data = query.data;
  return <View style={{ gap: 12 }}>
    <Text style={{ fontFamily: F.b, fontSize: 21, color: c.foreground }}>Country rates</Text>
    <Text style={{ fontFamily: F.r, fontSize: 14, color: c.mutedForeground }}>Choose the number country for rental/incoming rates, or the destination for outgoing calls and SMS.</Text>
    <View style={styles.chips}>{COUNTRIES.map(ct => <Press key={ct.code}
      testID={`rates-country-${ct.code}`} onPress={() => { setCountry(ct.code as TwilioCountryCode); setExpanded([]); }}
      accessibilityRole="radio" accessibilityState={{ selected: country === ct.code }}
      style={[styles.chip, { backgroundColor: country === ct.code ? c.accent : c.card, borderColor: country === ct.code ? c.primary : c.border }]}>
      <CountryMark country={ct} size={22} />
      <Text style={{ fontFamily: F.m, fontSize: 13, color: c.foreground }}>{ct.name}</Text>
    </Press>)}</View>
    <Text testID="rates-billing-currency" style={{ fontFamily: F.s, color: c.primary, fontSize: 14 }}>
      Display: {CURRENCIES[profile.billingCountry] ?? 'Unknown currency'} · Billing: {findCountry(profile.billingCountry)?.name ?? profile.billingCountry}
    </Text>
    <Btn label="Change billing country" testID="rates-change-billing" kind="ghost" onPress={() => router.push('/settings/billing')} />
    <DemoNote text="Linea rates = current Twilio cost × 3, converted on the server. Rental is rounded to 2 decimals; usage to 6, so small charges are not shown as free. Taxes, carrier surcharges, registration and other fees are not included." />
    {query.isLoading || !ready ? <ActivityIndicator color={c.primary} /> : query.isError ?
      <Text style={{ fontFamily: F.r, color: c.destructive }}>{query.error instanceof Error ? query.error.message : 'Unable to load pricing.'}</Text> :
      data?.sections.map(section => {
        const open = expanded.includes(section.kind);
        const rates = open ? section.rates : section.rates.slice(0, 12);
        return <View key={section.kind} style={[styles.section, { backgroundColor: c.card }]}>
          <Text style={{ fontFamily: F.b, color: c.foreground, fontSize: 18 }}>{TITLES[section.kind]}</Text>
          {section.error ? <Text testID={`pricing-error-${section.kind}`} style={{ fontFamily: F.r, color: c.destructive, fontSize: 14, lineHeight: 21 }}>{section.error}</Text> :
            !section.rates.length ? <Text style={{ fontFamily: F.r, color: c.mutedForeground }}>No rates published for this country.</Text> : <>
              <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 12 }}>
                {section.sourceCurrency} → {data.currency} · rate {section.exchangeRate}
                {section.exchangeDate ? ` · Frankfurter reference ${section.exchangeDate}` : ' · no conversion needed'}
              </Text>
              {rates.map((rate, index) => <View key={index} style={[styles.rate, { borderTopColor: c.border }]}>
                <Text style={{ fontFamily: F.s, color: c.primary, fontSize: 12 }}>{rate.direction.toUpperCase()}</Text>
                <Text style={{ fontFamily: F.m, color: c.foreground, fontSize: 14 }}>{rate.label}</Text>
                {rate.prefixes.length ? <Text numberOfLines={open ? undefined : 2} style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 12 }}>Destination prefixes: {rate.prefixes.join(', ')}</Text> : null}
                <Text style={{ fontFamily: F.b, color: c.foreground, fontSize: 16 }}>{money(rate.amount, data.currency, rate.unit !== 'month')} {data.currency}/{rate.unit}</Text>
              </View>)}
              {section.rates.length > 12 ? <Btn label={open ? 'Show fewer rates' : `Show all ${section.rates.length} rates`}
                kind="ghost" testID={`pricing-expand-${section.kind}`}
                onPress={() => setExpanded(open ? expanded.filter(k => k !== section.kind) : [...expanded, section.kind])} /> : null}
            </>}
        </View>;
      })}
    <Btn label="Refresh rates" icon="refresh-cw" testID="pricing-refresh" kind="ghost" onPress={() => query.refetch()} />
    {data ? <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 12 }}>Checked {new Date(data.fetchedAt).toLocaleString()}. Quotes may be cached for 5 minutes.</Text> : null}
    <DemoNote text="Outgoing rates vary by destination prefix, origin and carrier. SMS is charged per segment, not necessarily per message. This is not a final checkout quote; no purchases or charges are enabled." />
  </View>;
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 9 },
  section: { padding: 16, borderRadius: 14, gap: 12 },
  rate: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 5 },
});
