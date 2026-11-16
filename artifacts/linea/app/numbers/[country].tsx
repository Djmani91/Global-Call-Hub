import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  getGetTwilioAvailableNumbersQueryKey,
  useGetTwilioAvailableNumbers,
  getGetTwilioPricingQueryKey,
  useGetTwilioPricing,
} from '@workspace/api-client-react';
import type { TwilioCountryCode, TwilioPhoneNumberType } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { findCountry } from '@/data/demo';
import { Btn, CountryMark, DemoNote, EmptyState, F, Press, SearchBar, useBottomPad } from '@/components/ui';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useApp } from '@/context/AppContext';
import { PricingSummary } from '@/components/Pricing';
import { CURRENCIES } from '@/utils/currency';

const NUMBER_TYPES: { value: TwilioPhoneNumberType; label: string }[] = [
  { value: 'local', label: 'Local' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'toll-free', label: 'Toll-free' },
];

export default function CountryNumbers() {
  const c = useColors();
  const { profile, ready } = useApp();
  const { country } = useLocalSearchParams<{ country: string }>();
  const [phoneNumberType, setPhoneNumberType] = useState<TwilioPhoneNumberType>('local');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const ct = findCountry(country);
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
    phoneNumberType !== 'toll-free' && requestSearch?.length === 3,
  );
  const numbersQuery = useGetTwilioAvailableNumbers(
    {
      countryCode: (ct?.code ?? 'US') as TwilioCountryCode,
      phoneNumberType,
      search: requestSearch,
    },
    {
      query: {
        queryKey: getGetTwilioAvailableNumbersQueryKey({
          countryCode: (ct?.code ?? 'US') as TwilioCountryCode,
          phoneNumberType,
          search: requestSearch,
        }),
        enabled: Boolean(ct) && !searchPending && !needsMoreDigits,
        staleTime: 30_000,
        retry: 1,
      },
    },
  );
  const pricingParams = { countryCode: (ct?.code ?? 'US') as TwilioCountryCode,
    billingCountry: profile.billingCountry as TwilioCountryCode };
  const pricingQuery = useGetTwilioPricing(pricingParams, { query: {
    queryKey: getGetTwilioPricingQueryKey(pricingParams), enabled: Boolean(ct) && ready,
    staleTime: 60_000, retry: false,
  } });
  const pricing = !pricingQuery.isError ? pricingQuery.data : undefined;
  const pricingError = pricing?.sections.find(s => s.kind === 'numbers')?.error;

  if (!ct) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <EmptyState icon="globe" title="Unknown country" body="Go back and pick a country from the list." />
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
        {NUMBER_TYPES.map((item) => {
          const active = phoneNumberType === item.value;
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
                  {pricing ? <PricingSummary pricing={pricing} numberType={phoneNumberType} /> :
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
              <Btn
                label="Purchase is off in this preview"
                testID="live-number-purchase-disabled"
                onPress={() => {}}
                disabled
                kind="ghost"
              />
              <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 12, lineHeight: 18, textAlign: 'center' }}>
                No number has been reserved or bought. We’ll add the purchase step later.
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="phone"
          title="No numbers returned"
          body={requestSearch
            ? `Twilio found no ${phoneNumberType} numbers matching ${requestSearch} in ${ct.name}. Try different digits or another number type.`
            : `Twilio did not return ${phoneNumberType} numbers for ${ct.name} in this search. Try another number type or country.`}
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
});
