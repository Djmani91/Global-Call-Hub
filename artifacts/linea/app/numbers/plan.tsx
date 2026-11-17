import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  getGetTwilioAvailableNumberCountriesQueryKey,
  getGetTwilioPricingQueryKey,
  useGetTwilioAvailableNumberCountries,
  useGetTwilioPricing,
} from '@workspace/api-client-react';
import type { BillingCountryCode, CountryPricing, TwilioPhoneNumberType } from '@workspace/api-client-react';
import { useApp } from '@/context/AppContext';
import { countryFromTwilio, findCountry } from '@/data/demo';
import { useColors } from '@/hooks/useColors';
import { Btn, CountryMark, EmptyState, F, Press, useBottomPad } from '@/components/ui';
import { CURRENCIES, money } from '@/utils/currency';

const PLANS = [
  { months: 1 as const, title: '1 Month', discount: 0 },
  { months: 3 as const, title: '3 Months', discount: 52 },
  { months: 12 as const, title: '12 Months', discount: 70 },
];

const normalizeType = (value: string) => value.toLowerCase().replace(/[^a-z]/g, '');

function rentalRate(pricing: CountryPricing | undefined, numberType: TwilioPhoneNumberType) {
  const section = pricing?.sections.find(item => item.kind === 'numbers');
  if (!section || section.error) return undefined;
  return section.rates.find(rate => normalizeType(rate.numberType) === normalizeType(numberType))?.amount;
}

function usageRate(pricing: CountryPricing | undefined, kind: 'voice' | 'sms', direction: 'incoming' | 'outgoing', type: TwilioPhoneNumberType) {
  if (!pricing) return 'Loading…';
  const section = pricing.sections.find(item => item.kind === kind);
  if (!section || section.error) return 'Unavailable';
  const rates = section.rates.filter(rate => rate.direction === direction);
  if (!rates.length) return 'Unavailable';
  if (direction === 'incoming') {
    const rate = rates.find(item => normalizeType(item.numberType) === normalizeType(type));
    return rate ? `${money(rate.amount, pricing!.currency, true)}/${kind === 'voice' ? 'min' : 'segment'}` : 'Unavailable';
  }
  const lowest = Math.min(...rates.map(item => item.amount));
  return `From ${money(lowest, pricing!.currency, true)}/${kind === 'voice' ? 'min' : 'segment'}`;
}

export default function NumberPlan() {
  const c = useColors();
  const { profile, ready } = useApp();
  const params = useLocalSearchParams<{ number?: string; country?: string; type?: string; voice?: string }>();
  const countryCode = params.country ?? '';
  const number = params.number ?? '';
  const numberType: TwilioPhoneNumberType = params.type === 'mobile' || params.type === 'toll-free'
    ? params.type
    : 'local';
  const bottom = useBottomPad(false);
  const [selectedTerm, setSelectedTerm] = useState<1 | 3 | 12>(1);
  const countriesQuery = useGetTwilioAvailableNumberCountries({ query: {
    queryKey: getGetTwilioAvailableNumberCountriesQueryKey(),
    staleTime: 5 * 60_000,
    retry: 1,
  } });
  const countryEntry = countriesQuery.data?.countries.find(item => item.countryCode === countryCode);
  const country = countryEntry ? countryFromTwilio(countryEntry) : findCountry(countryCode);
  const pricingParams = {
    countryCode,
    billingCountry: profile.billingCountry as BillingCountryCode,
  };
  const pricingQuery = useGetTwilioPricing(pricingParams, { query: {
    queryKey: getGetTwilioPricingQueryKey(pricingParams),
    enabled: Boolean(countryCode && ready),
    staleTime: 60_000,
    retry: false,
  } });
  const pricing = pricingQuery.data;
  const monthly = rentalRate(pricing, numberType);
  const plan = PLANS.find(item => item.months === selectedTerm)!;
  const standardTotal = monthly === undefined ? undefined : Math.round(monthly * selectedTerm * 100) / 100;
  const dueToday = standardTotal === undefined ? undefined : Math.round(standardTotal * (100 - plan.discount)) / 100;
  const monthlyEquivalent = dueToday === undefined ? undefined : dueToday / selectedTerm;

  if (!country && countriesQuery.isLoading) {
    return <View style={[styles.loading, { backgroundColor: c.background }]}><ActivityIndicator color={c.primary} /></View>;
  }
  if (!country || !number) {
    return <View style={{ flex: 1, backgroundColor: c.background }}>
      <EmptyState icon="phone" title="Number details unavailable" body="Go back to number search and choose a live number." />
    </View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: 'Get your Number', headerTitleAlign: 'center' }} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 12, gap: 14 }}>
        <View style={[styles.numberCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <CountryMark country={country} size={38} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.b, color: c.foreground, fontSize: 18 }}>{number}</Text>
            <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 13, marginTop: 3 }}>
              {country.name} · {numberType === 'toll-free' ? 'Toll-free' : numberType[0].toUpperCase() + numberType.slice(1)}
            </Text>
          </View>
        </View>

        <View style={[styles.rateCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={{ fontFamily: F.b, color: c.foreground, fontSize: 15 }}>
            Call & SMS usage rates · {pricing?.currency ?? CURRENCIES[profile.billingCountry]}
          </Text>
          <View style={[styles.feature, { borderBottomColor: c.border }]}>
            <Text style={{ fontFamily: F.s, color: c.foreground, fontSize: 14 }}>Make calls</Text>
            <Text style={{ fontFamily: F.b, color: c.primary, fontSize: 13 }}>
              {usageRate(pricing, 'voice', 'outgoing', numberType)}
            </Text>
          </View>
          <View style={[styles.feature, { borderBottomColor: c.border }]}>
            <Text style={{ fontFamily: F.s, color: c.foreground, fontSize: 14 }}>Receive calls</Text>
            <Text style={{ fontFamily: F.b, color: c.primary, fontSize: 13 }}>
              {usageRate(pricing, 'voice', 'incoming', numberType)}
            </Text>
          </View>
          <View style={[styles.feature, { borderBottomColor: c.border }]}>
            <Text style={{ fontFamily: F.s, color: c.foreground, fontSize: 14 }}>Send SMS</Text>
            <Text style={{ fontFamily: F.b, color: c.primary, fontSize: 13 }}>
              {usageRate(pricing, 'sms', 'outgoing', numberType)}
            </Text>
          </View>
          <View style={[styles.feature, { borderBottomColor: c.border }]}>
            <Text style={{ fontFamily: F.s, color: c.foreground, fontSize: 14 }}>Receive SMS</Text>
            <Text style={{ fontFamily: F.b, color: c.primary, fontSize: 13 }}>
              {usageRate(pricing, 'sms', 'incoming', numberType)}
            </Text>
          </View>
          <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 12, lineHeight: 17 }}>
            SMS is metered per segment; no unlimited SMS is included. Outgoing rates vary by destination and network.
          </Text>
          <Btn label="See all call & SMS rates" testID="plan-view-rates" kind="ghost"
            onPress={() => router.push({ pathname: '/settings/[section]', params: { section: 'rates', country: country.code } })} />
        </View>

        <View style={[styles.planCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={{ fontFamily: F.b, color: c.foreground, fontSize: 18 }}>Choose your rental term</Text>
          <View style={styles.plans}>
            {PLANS.map(item => {
              const active = selectedTerm === item.months;
              const totalBeforeDiscount = monthly === undefined ? undefined : Math.round(monthly * item.months * 100) / 100;
              const total = totalBeforeDiscount === undefined ? undefined : Math.round(totalBeforeDiscount * (100 - item.discount)) / 100;
              return (
                <Press
                  key={item.months}
                  testID={`number-term-${item.months}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedTerm(item.months)}
                  style={[
                    styles.planOption,
                    { backgroundColor: active ? c.accent : c.background, borderColor: active ? c.primary : c.border },
                  ]}
                >
                  <Text numberOfLines={1} style={{ fontFamily: F.s, color: c.foreground, fontSize: 12 }}>{item.title}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: F.b, color: c.primary, fontSize: 13, marginTop: 4 }}>
                    {total === undefined ? '—' : money(total, pricing?.currency ?? CURRENCIES[profile.billingCountry])}
                  </Text>
                  <Text style={{ fontFamily: F.m, color: c.primary, fontSize: 10, marginTop: 3 }}>
                    {item.discount > 0 ? `Save ${item.discount}%` : 'Monthly'}
                  </Text>
                </Press>
              );
            })}
          </View>
          <View style={styles.price}>
            {dueToday !== undefined && pricing ? (
              <>
                <Text style={{ fontFamily: F.b, color: c.foreground, fontSize: 30 }}>
                  {money(monthlyEquivalent!, pricing.currency)}/month
                </Text>
                <Text style={{ fontFamily: F.m, color: c.mutedForeground, fontSize: 14 }}>
                  {standardTotal !== dueToday ? (
                    <Text style={{ textDecorationLine: 'line-through' }}>{money(standardTotal!, pricing.currency)}  </Text>
                  ) : null}
                  {money(dueToday, pricing.currency)} due upfront for {selectedTerm} {selectedTerm === 1 ? 'month' : 'months'}
                </Text>
              </>
            ) : (
              <Text style={{ fontFamily: F.s, color: c.mutedForeground, fontSize: 14 }}>
                {pricingQuery.isLoading || !ready ? 'Loading number price…' : 'Number price unavailable'}
              </Text>
            )}
          </View>
          <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 12, lineHeight: 18, textAlign: 'center' }}>
            {dueToday !== undefined && pricing
              ? `Paid upfront. Auto-renews every ${selectedTerm} ${selectedTerm === 1 ? 'month' : 'months'} at ${money(dueToday, pricing.currency)} unless cancelled.`
              : `Paid upfront; auto-renews for the selected ${selectedTerm}-month term.`}
          </Text>
          <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 12, textAlign: 'center' }}>
            Number rental only. Call/SMS usage, taxes and extra fees are separate.
          </Text>
        </View>
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: c.border, paddingBottom: bottom }]}>
        <Btn label="Purchase unavailable in preview" testID="plan-purchase-disabled" disabled onPress={() => {}} />
        <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 11, textAlign: 'center', marginTop: 6 }}>
          No number is reserved and no payment or renewal is started.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  numberCard: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, padding: 14, borderWidth: 1, borderRadius: 14 },
  rateCard: { borderWidth: 1, borderRadius: 16, padding: 15, gap: 10 },
  feature: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 9, gap: 10 },
  planCard: { borderWidth: 1, borderRadius: 16, padding: 15, gap: 12 },
  plans: { flexDirection: 'row', gap: 6 },
  planOption: { flex: 1, minHeight: 84, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderRadius: 13, paddingHorizontal: 4, paddingVertical: 9 },
  price: { alignItems: 'center', gap: 6, paddingVertical: 9 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingTop: 12 },
});
