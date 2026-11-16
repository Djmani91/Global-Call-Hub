import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  getGetTwilioAvailableNumbersQueryKey,
  useGetTwilioAvailableNumbers,
} from '@workspace/api-client-react';
import type { TwilioCountryCode, TwilioPhoneNumberType } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { findCountry } from '@/data/demo';
import { Btn, CountryMark, DemoNote, EmptyState, F, Press, useBottomPad } from '@/components/ui';

const NUMBER_TYPES: { value: TwilioPhoneNumberType; label: string }[] = [
  { value: 'local', label: 'Local' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'toll-free', label: 'Toll-free' },
];

export default function CountryNumbers() {
  const c = useColors();
  const { country } = useLocalSearchParams<{ country: string }>();
  const [phoneNumberType, setPhoneNumberType] = useState<TwilioPhoneNumberType>('local');
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const ct = findCountry(country);
  const bottom = useBottomPad(false);
  const numbersQuery = useGetTwilioAvailableNumbers(
    {
      countryCode: (ct?.code ?? 'US') as TwilioCountryCode,
      phoneNumberType,
    },
    {
      query: {
        queryKey: getGetTwilioAvailableNumbersQueryKey({
          countryCode: (ct?.code ?? 'US') as TwilioCountryCode,
          phoneNumberType,
        }),
        enabled: Boolean(ct),
        staleTime: 30_000,
        retry: 1,
      },
    },
  );

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
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ padding: 18, paddingBottom: bottom, gap: 12 }}
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

      <View style={[styles.liveBadge, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={[styles.liveDot, { backgroundColor: c.primary }]} />
        <Text style={{ fontFamily: F.s, color: c.foreground, fontSize: 13 }}>
          Live availability from Twilio
        </Text>
        <Press
          testID="refresh-live-numbers"
          accessibilityLabel="Refresh number availability"
          onPress={() => { setSelectedNumber(null); numbersQuery.refetch(); }}
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

      <DemoNote text="These are live search results, not a reservation. Availability can change. Twilio returns capabilities here, but not the final rental or usage price." icon="radio" />

      {numbersQuery.isLoading ? (
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
            {numbersQuery.data.numbers.length} number{numbersQuery.data.numbers.length === 1 ? '' : 's'} returned · updated {new Date(numbersQuery.data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
          body={`Twilio did not return ${phoneNumberType} numbers for ${ct.name} in this search. Try another number type or country.`}
        />
      )}

      <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingTop: 4 }}>
        Number availability and required documents vary by country. No purchase or charge is made in this preview.
      </Text>
    </ScrollView>
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
