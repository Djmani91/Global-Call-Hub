import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  getGetTwilioAvailableNumbersQueryKey,
  useGetTwilioAvailableNumbers,
  getGetTwilioAvailableNumberCountriesQueryKey,
  useGetTwilioAvailableNumberCountries,
  getGetTwilioPricingQueryKey,
  useGetTwilioPricing,
} from '@workspace/api-client-react';
import type { BillingCountryCode, TwilioCountryCode, TwilioPhoneNumberType } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { countryFromTwilio, findCountry } from '@/data/demo';
import { Btn, CountryMark, DemoNote, EmptyState, F, Press, SearchBar, useBottomPad } from '@/components/ui';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useApp } from '@/context/AppContext';
import { monthlyRentalRate, PricingSummary } from '@/components/Pricing';
import { CURRENCIES, money } from '@/utils/currency';

const NUMBER_TYPES: { value: TwilioPhoneNumberType; label: string }[] = [
  { value: 'local', label: 'Local' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'toll-free', label: 'Toll-free' },
];

const RENTAL_PLANS = [
  { months: 1 as const, title: '1 Month', discount: 0 },
  { months: 3 as const, title: '3 Months', discount: 52 },
  { months: 12 as const, title: '12 Months', discount: 70 },
];

export default function CountryNumbers() {
  const c = useColors();
  const { profile, ready } = useApp();
  const { country } = useLocalSearchParams<{ country: string }>();
  const countriesQuery = useGetTwilioAvailableNumberCountries({ query: {
    queryKey: getGetTwilioAvailableNumberCountriesQueryKey(),
    staleTime: 5 * 60_000,
    retry: 1,
  } });
  const countryEntry = countriesQuery.data?.countries.find(item => item.countryCode === country);
  const ct = countryEntry ? countryFromTwilio(countryEntry) : findCountry(country);
  const [phoneNumberType, setPhoneNumberType] = useState<TwilioPhoneNumberType>('mobile');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<1 | 3 | 12>(1);
  const availableTypes = countryEntry?.numberTypes ?? NUMBER_TYPES.map(item => item.value);
  const activeType = availableTypes.includes(phoneNumberType) ? phoneNumberType : (availableTypes[0] ?? 'local');
  const bottom = useBottomPad(false);
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchTerm), 350);
    return () => clearTimeout(timeout);
  }, [searchTerm]);
  const searchPending = searchTerm !== debouncedSearch;
  const needsMoreDigits = searchTerm.length === 1;
  const requestSearch = debouncedSearch.length >= 2 ? debouncedSearch : undefined;
  const usesAreaCodeFilter = Boolean(
    ct && (ct.code === 'US' || ct.code === 'CA') &&
    activeType !== 'toll-free' && requestSearch?.length === 3,
  );
  const numbersQuery = useGetTwilioAvailableNumbers(
    {
      countryCode: (ct?.code ?? 'US') as TwilioCountryCode,
      phoneNumberType: activeType,
      search: requestSearch,
    },
    {
      query: {
        queryKey: getGetTwilioAvailableNumbersQueryKey({
          countryCode: (ct?.code ?? 'US') as TwilioCountryCode,
          phoneNumberType: activeType,
          search: requestSearch,
        }),
        enabled: Boolean(ct) && !searchPending && !needsMoreDigits,
        staleTime: 30_000,
        retry: 1,
      },
    },
  );
  const pricingParams = { countryCode: (ct?.code ?? 'US') as TwilioCountryCode,
    billingCountry: profile.billingCountry as BillingCountryCode };
  const pricingQuery = useGetTwilioPricing(pricingParams, { query: {
    queryKey: getGetTwilioPricingQueryKey(pricingParams), enabled: Boolean(ct) && ready,
    staleTime: 60_000, retry: false,
  } });
  const pricing = !pricingQuery.isError ? pricingQuery.data : undefined;
  const pricingError = pricing?.sections.find(s => s.kind === 'numbers')?.error;
  const monthlyRental = pricing ? monthlyRentalRate(pricing, activeType) : undefined;
  const plan = RENTAL_PLANS.find(item => item.months === selectedTerm)!;
  const standardTotal = monthlyRental === undefined ? undefined : Math.round(monthlyRental * selectedTerm * 100) / 100;
  const upfrontTotal = standardTotal === undefined
    ? undefined
    : Math.round(standardTotal * (100 - plan.discount)) / 100;
  const monthlyEquivalent = upfrontTotal === undefined ? undefined : upfrontTotal / selectedTerm;
  const selectedNumberInfo = numbersQuery.data?.numbers.find(item => item.phoneNumber === selectedNumber);

  if (!ct && countriesQuery.isLoading) {
    return <View style={{ flex: 1, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={c.primary} />
    </View>;
  }
  if (!ct) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <EmptyState icon="globe" title="Country unavailable" body={countriesQuery.isError ? 'Could not load the Twilio country list. Go back and retry.' : 'This country is not in your Twilio number catalog. Go back and choose another country.'} />
      </View>
    );
  }

  const errorMessage = numbersQuery.error instanceof Error
    ? numbersQuery.error.message
    : 'Twilio could not load number availability.';
  const missingPermission = errorMessage.includes('permission to search available phone numbers');

  return (
    <KeyboardAwareScrollViewCompat
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ padding: 18, paddingBottom: bottom, gap: 12 }}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: ct.name }} />
      <View style={styles.head}>
        <CountryMark country={ct} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.b, fontSize: 20, color: c.foreground }}>
            {ct.name} {ct.dial}
          </Text>
          <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground, marginTop: 3 }}>
            {ct.note}
          </Text>
        </View>
      </View>

      <SearchBar
        value={searchTerm}
        onChange={(value) => {
          setSelectedNumber(null);
          setSearchTerm(value.replace(/\D/g, '').slice(0, 16));
        }}
        testID="available-number-search"
        placeholder="Search by area code or digits"
        keyboardType="number-pad"
      />

      <View style={[styles.liveBadge, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={[styles.liveDot, { backgroundColor: c.primary }]} />
        <Text style={{ fontFamily: F.s, color: c.foreground, fontSize: 13 }}>
          Live availability from Twilio
        </Text>
        <Press
          testID="refresh-live-numbers"
          accessibilityLabel="Refresh number availability"
          onPress={() => { setSelectedNumber(null); numbersQuery.refetch(); pricingQuery.refetch(); }}
          style={{ padding: 4, marginLeft: 'auto' }}
        >
          <Feather name="refresh-cw" size={17} color={c.primary} />
        </Press>
      </View>

      <View accessibilityRole="tablist" style={[styles.typePicker, { backgroundColor: c.card }]}>
        {NUMBER_TYPES.filter(item => availableTypes.includes(item.value)).map((item) => {
          const active = activeType === item.value;
          return (
            <Press
              key={item.value}
              testID={`number-type-${item.value}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                setSelectedNumber(null);
                setPhoneNumberType(item.value);
              }}
              style={[
                styles.typeButton,
                { backgroundColor: active ? c.primary : 'transparent' },
              ]}
            >
              <Text style={{
                fontFamily: F.s,
                fontSize: 13,
                color: active ? c.primaryForeground : c.mutedForeground,
              }}>
                {item.label}
              </Text>
            </Press>
          );
        })}
      </View>

      <DemoNote text="Live inventory, not a reservation. Standard country/type rental prices include Linea's 3× rate and billing-currency conversion, excluding taxes and extra fees. Purchases are disabled." icon="radio" />
      <Text style={{ fontFamily: F.m, color: c.primary, fontSize: 13 }}>Display currency: {CURRENCIES[profile.billingCountry]}</Text>
      {pricingError || pricingQuery.isError ? <Text testID="number-pricing-error"
        style={{ fontFamily: F.r, color: c.destructive, fontSize: 13, lineHeight: 19 }}>
        {pricingError ?? 'Unable to load rental pricing. Please retry.'}
      </Text> : null}
      <Btn label="Rental, call & SMS rates" testID="numbers-view-rates" kind="ghost"
        onPress={() => router.push({ pathname: '/settings/[section]', params: { section: 'rates', country: ct.code } })} />

      {searchTerm.length >= 2 ? (
        <Text style={{ fontFamily: F.m, color: c.mutedForeground, fontSize: 13 }}>
          {usesAreaCodeFilter
            ? `Area code ${requestSearch} · matched by Twilio`
            : `Matching digits ${requestSearch} in available numbers`}
        </Text>
      ) : null}

      {needsMoreDigits ? (
        <EmptyState icon="search" title="Add one more digit" body="Enter at least two digits to search Twilio's available numbers." />
      ) : searchPending || numbersQuery.isLoading ? (
        <View style={styles.state}>
          <ActivityIndicator size="small" color={c.primary} />
          <Text style={{ fontFamily: F.m, color: c.mutedForeground, fontSize: 14 }}>
            Checking Twilio for available numbers…
          </Text>
        </View>
      ) : numbersQuery.isError ? (
        <View style={[styles.errorCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Feather name="alert-circle" size={22} color={c.destructive} />
          <Text style={{ fontFamily: F.s, color: c.foreground, fontSize: 16, textAlign: 'center' }}>
            {missingPermission ? 'Twilio search permission needed' : 'Could not load live numbers'}
          </Text>
          <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
            {missingPermission
              ? 'The restricted key needs permission to list available phone numbers.'
              : errorMessage}
          </Text>
          <Btn
            label="Try again"
            icon="refresh-cw"
            testID="retry-live-numbers"
            onPress={() => numbersQuery.refetch()}
            kind="ghost"
          />
        </View>
      ) : numbersQuery.data?.numbers.length ? (
        <>
          <Text style={{ fontFamily: F.m, color: c.mutedForeground, fontSize: 13 }}>
            {numbersQuery.data.numbers.length === 20 ? 'Showing up to 20' : numbersQuery.data.numbers.length} number{numbersQuery.data.numbers.length === 1 ? '' : 's'} returned · updated {new Date(numbersQuery.data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {numbersQuery.data.numbers.map((number) => {
            const isSelected = selectedNumber === number.phoneNumber;
            const services = [
              number.capabilities.voice ? 'Voice' : null,
              number.capabilities.sms ? 'SMS' : null,
              number.capabilities.mms ? 'MMS' : null,
            ].filter(Boolean).join(' · ');
            const location = [number.locality, number.region].filter(Boolean).join(', ');
            return (
              <Press
                key={number.phoneNumber}
                testID={`live-number-${number.phoneNumber}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelectedNumber(number.phoneNumber)}
                style={[
                  styles.numberRow,
                  {
                    backgroundColor: c.card,
                    borderColor: isSelected ? c.primary : c.border,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontFamily: F.b, fontSize: 18, color: c.foreground }}>
                    {number.friendlyName}
                  </Text>
                  <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>
                    {location || ct.name} · {services || 'No voice or messaging capability listed'}
                  </Text>
                  {pricing ? <PricingSummary pricing={pricing} numberType={activeType} /> :
                    <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>
                      {pricingQuery.isLoading || !ready ? 'Loading monthly price…' : 'Monthly price unavailable'}
                    </Text>}
                </View>
                <Feather
                  name={isSelected ? 'check-circle' : 'circle'}
                  size={21}
                  color={isSelected ? c.primary : c.mutedForeground}
                />
              </Press>
            );
          })}
          {selectedNumber ? (
            <View style={[styles.selectedCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={{ fontFamily: F.m, color: c.mutedForeground, fontSize: 13 }}>
                Selected number
              </Text>
              <Text style={{ fontFamily: F.b, color: c.foreground, fontSize: 18, marginTop: 3 }}>
                {selectedNumber}
              </Text>
              {selectedNumberInfo ? (
                <Text style={{ fontFamily: F.s, color: c.primary, fontSize: 13, marginTop: 4 }}>
                  {selectedNumberInfo.capabilities.voice ? 'Voice calling' : 'No voice'} · SMS enabled
                </Text>
              ) : null}
              <Text style={{ fontFamily: F.b, color: c.foreground, fontSize: 15, marginTop: 14 }}>
                Choose a rental term
              </Text>
              <View style={styles.planOptions}>
                {RENTAL_PLANS.map(item => {
                  const active = item.months === selectedTerm;
                  const itemStandardTotal = monthlyRental === undefined
                    ? undefined
                    : Math.round(monthlyRental * item.months * 100) / 100;
                  const itemTotal = monthlyRental === undefined
                    ? undefined
                    : Math.round(itemStandardTotal! * (100 - item.discount)) / 100;
                  return (
                    <Press
                      key={item.months}
                      testID={`number-term-${item.months}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      onPress={() => setSelectedTerm(item.months)}
                      style={[
                        styles.planOption,
                        { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.accent : c.background },
                      ]}
                    >
                      <Text style={{ fontFamily: F.s, color: c.foreground, fontSize: 12 }}>{item.title}</Text>
                      <Text style={{ fontFamily: F.b, color: c.primary, fontSize: 12, marginTop: 4 }}>
                        {itemTotal === undefined ? '—' : money(itemTotal, pricing?.currency ?? CURRENCIES[profile.billingCountry])}
                      </Text>
                      {item.discount > 0 ? (
                        <Text style={{ fontFamily: F.m, color: c.primary, fontSize: 10, marginTop: 3 }}>
                          Save {item.discount}%
                        </Text>
                      ) : null}
                    </Press>
                  );
                })}
              </View>
              <View style={styles.planPrice}>
                {upfrontTotal !== undefined && monthlyEquivalent !== undefined ? (
                  <>
                    <Text style={{ fontFamily: F.b, color: c.foreground, fontSize: 28 }}>
                      {money(monthlyEquivalent, pricing!.currency)}/month
                    </Text>
                    <Text style={{ fontFamily: F.m, color: c.mutedForeground, fontSize: 14 }}>
                      {standardTotal !== upfrontTotal ? (
                        <Text style={{ textDecorationLine: 'line-through' }}>{money(standardTotal!, pricing!.currency)}  </Text>
                      ) : null}
                      {money(upfrontTotal, pricing!.currency)} due upfront for {selectedTerm} {selectedTerm === 1 ? 'month' : 'months'}
                    </Text>
                  </>
                ) : (
                  <Text style={{ fontFamily: F.s, color: c.mutedForeground, fontSize: 14 }}>
                    {pricingQuery.isLoading ? 'Loading number price…' : 'Number price unavailable'}
                  </Text>
                )}
              </View>
              <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 12, lineHeight: 18, textAlign: 'center' }}>
                {upfrontTotal !== undefined
                  ? `Paid upfront. Auto-renews every ${selectedTerm} ${selectedTerm === 1 ? 'month' : 'months'} at ${money(upfrontTotal, pricing!.currency)} unless cancelled.`
                  : `Paid upfront; auto-renews for the selected ${selectedTerm}-month term.`}
              </Text>
              <View style={[styles.usageNote, { backgroundColor: c.background }]}>
                <Text style={{ fontFamily: F.s, color: c.foreground, fontSize: 13 }}>
                  Calls and SMS are billed separately by usage
                </Text>
                <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 12, lineHeight: 17, marginTop: 4 }}>
                  Twilio provides no unlimited-SMS allowance here. Messages are metered per segment.
                </Text>
                <Btn label="See call & SMS rates" testID="selected-number-view-rates" kind="ghost"
                  onPress={() => router.push({ pathname: '/settings/[section]', params: { section: 'rates', country: ct.code } })} />
              </View>
              <Btn
                label="Purchase unavailable in preview"
                testID="live-number-purchase-disabled"
                onPress={() => {}}
                disabled
                kind="ghost"
              />
              <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 12, lineHeight: 18, textAlign: 'center' }}>
                This is only a price preview. No number is reserved and no payment or renewal is started.
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="phone"
          title="No SMS-capable numbers returned"
          body={requestSearch
            ? `Twilio found no SMS-capable ${activeType} numbers matching ${requestSearch} in ${ct.name}. Try different digits or another number type.`
            : `Twilio did not return SMS-capable ${activeType} numbers for ${ct.name}. Try another number type or country.`}
        />
      )}

      <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingTop: 4 }}>
        Number availability and required documents vary by country. No purchase or charge is made in this preview.
      </Text>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 13, padding: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  typePicker: { flexDirection: 'row', padding: 4, borderRadius: 14, gap: 4 },
  typeButton: { flex: 1, minHeight: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 11, paddingHorizontal: 8 },
  state: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 46 },
  errorCard: { alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 18 },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 14, padding: 15 },
  selectedCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 11 },
  planOptions: { flexDirection: 'row', gap: 7 },
  planOption: { flex: 1, minHeight: 76, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 4, paddingVertical: 9 },
  planPrice: { alignItems: 'center', gap: 5, paddingVertical: 12 },
  usageNote: { borderRadius: 12, padding: 12 },
});
