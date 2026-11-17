import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth, useSignIn, useSignUp } from '@clerk/expo';
import { getCountries, getCountryCallingCode, parsePhoneNumber } from 'libphonenumber-js';
import {
  useCheckCustomerPhoneVerification,
  useCompleteCustomerRegistration,
  getGetCustomerAuthReadinessQueryKey,
  useStartCustomerPhoneVerification,
  useGetCustomerAuthReadiness,
  setAuthTokenGetter,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Btn, F, ScreenHeader } from '@/components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type RegionCode = ReturnType<typeof getCountries>[number];
type PhoneCountry = { code: RegionCode; name: string; dial: string };
type Step = 'phone' | 'sms' | 'email' | 'email-code' | 'name';

const COMMON_NAMES: Record<string, string> = {
  GB: 'United Kingdom', US: 'United States', CA: 'Canada', AU: 'Australia',
  NZ: 'New Zealand', IE: 'Ireland', IN: 'India', PK: 'Pakistan',
  FR: 'France', DE: 'Germany', ES: 'Spain', IT: 'Italy', BR: 'Brazil',
  NG: 'Nigeria', ZA: 'South Africa', SG: 'Singapore', AE: 'United Arab Emirates',
};

function countryName(code: string) {
  if (COMMON_NAMES[code]) return COMMON_NAMES[code];
  try {
    if (typeof Intl.DisplayNames === 'function') {
      return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
    }
  } catch {}
  return code;
}

function flagFor(code: string) {
  return Array.from(code.toUpperCase(), (letter) =>
    String.fromCodePoint(127397 + letter.charCodeAt(0)),
  ).join('');
}

function safeError(error: unknown, fallback: string) {
  const value = error as {
    errors?: Array<{ longMessage?: string; message?: string }>;
    message?: string;
  };
  const clerkMessage = value?.errors?.find((item) => item.longMessage || item.message);
  return clerkMessage?.longMessage ?? clerkMessage?.message ?? fallback;
}

function maskPhone(phone: string) {
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 4)}${'•'.repeat(Math.min(7, phone.length - 6))}${phone.slice(-3)}`;
}

export default function CustomerAuth() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const { signUp, fetchStatus: signUpFetchStatus } = useSignUp();
  const { setProfile, profile } = useApp();
  const startPhone = useStartCustomerPhoneVerification();
  const checkPhone = useCheckCustomerPhoneVerification();
  const completeRegistration = useCompleteCustomerRegistration();
  const readiness = useGetCustomerAuthReadiness({
    query: { queryKey: getGetCustomerAuthReadinessQueryKey(), retry: false, staleTime: 15_000 },
  });
  const [step, setStep] = useState<Step>('phone');
  const [countryCode, setCountryCode] = useState<RegionCode>('GB');
  const [nationalNumber, setNationalNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [registrationToken, setRegistrationToken] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [error, setError] = useState('');

  const countries = useMemo<PhoneCountry[]>(() =>
    getCountries()
      .map((code) => ({ code, name: countryName(code), dial: `+${getCountryCallingCode(code)}` }))
      .sort((a, b) => a.name.localeCompare(b.name)), []);
  const country = countries.find((item) => item.code === countryCode) ??
    { code: 'GB' as RegionCode, name: 'United Kingdom', dial: '+44' };
  const filteredCountries = countries.filter((item) =>
    `${item.name} ${item.code} ${item.dial}`.toLowerCase().includes(countrySearch.toLowerCase()),
  );
  const parsedPhone = useMemo(() => {
    if (!nationalNumber.trim()) return null;
    try {
      const parsed = parsePhoneNumber(nationalNumber, countryCode);
      return parsed?.isValid() ? parsed.number : null;
    } catch {
      return null;
    }
  }, [countryCode, nationalNumber]);
  const busy = startPhone.isPending || checkPhone.isPending ||
    completeRegistration.isPending || signUpFetchStatus === 'fetching';
  const phoneReady = readiness.data?.phoneVerificationEnabled === true;

  useEffect(() => {
    if (isSignedIn && step === 'phone') router.replace('/(tabs)');
  }, [isSignedIn, step]);

  async function beginPhoneVerification() {
    setError('');
    if (!parsedPhone) {
      setError('Enter a valid mobile number for the selected country.');
      return;
    }
    try {
      const result = await startPhone.mutateAsync({ data: { phoneNumber: parsedPhone } });
      setPhoneNumber(parsedPhone);
      setChallengeId(result.challengeId);
      setSmsCode('');
      setStep('sms');
    } catch (requestError) {
      setError(safeError(requestError, 'We could not send a code. Check the number and try again.'));
    }
  }

  async function verifyPhoneCode() {
    setError('');
    if (!challengeId || smsCode.trim().length < 4) {
      setError('Enter the code from your SMS.');
      return;
    }
    try {
      const result = await checkPhone.mutateAsync({ data: { challengeId, code: smsCode.trim() } });
      if (result.status === 'signed_in' && result.signInToken) {
        const { error: ticketError } = await signIn.ticket({ ticket: result.signInToken });
        if (ticketError) throw ticketError;
        if (signIn.status !== 'complete') {
          throw new Error('Phone sign-in did not complete.');
        }
        await signIn.finalize({ navigate: () => undefined });
        router.replace('/(tabs)');
        return;
      }
      if (!result.registrationToken) throw new Error('Phone verification could not continue.');
      setRegistrationToken(result.registrationToken);
      setStep('email');
    } catch (requestError) {
      setError(safeError(requestError, 'That code did not work. Check it or request a new one.'));
    }
  }

  async function sendEmailCode() {
    setError('');
    if (!email.trim() || password.length < 8) {
      setError('Enter your email and a password with at least 8 characters.');
      return;
    }
    try {
      const { error: createError } = await signUp.password({
        emailAddress: email.trim(),
        password,
      });
      if (createError) throw createError;
      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) throw sendError;
      setStep('email-code');
    } catch (requestError) {
      setError(safeError(requestError, 'We could not send the email code. Check your email and try again.'));
    }
  }

  async function verifyEmailCode() {
    setError('');
    if (emailCode.trim().length < 4) {
      setError('Enter the code from your email.');
      return;
    }
    try {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({
        code: emailCode.trim(),
      });
      if (verifyError) throw verifyError;
      setStep('name');
    } catch (requestError) {
      setError(safeError(requestError, 'That email code did not work. Check it or request another.'));
    }
  }

  async function finishSignup() {
    setError('');
    const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? '';
    const lastName = nameParts.slice(1).join(' ');
    if (!firstName) {
      setError('Enter your name to finish creating the account.');
      return;
    }
    if (!registrationToken) {
      setError('Your phone verification expired. Start again to verify your number.');
      setStep('phone');
      return;
    }
    try {
      const { error: updateError } = await signUp.update({ firstName, lastName });
      if (updateError) throw updateError;
      if (signUp.status !== 'complete') {
        throw new Error('Your signup is missing a required detail.');
      }
      await signUp.finalize({ navigate: () => undefined });
      setAuthTokenGetter(() => getToken());
      await completeRegistration.mutateAsync({ data: { registrationToken } });
      setProfile({
        ...profile,
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
      });
      router.replace('/(tabs)');
    } catch (requestError) {
      setError(safeError(requestError, 'Your account could not be completed. Please try again.'));
    }
  }

  async function changePhone() {
    setError('');
    setChallengeId('');
    setRegistrationToken('');
    setSmsCode('');
    setEmailCode('');
    setStep('phone');
    try { await signUp.reset(); } catch {}
  }

  const stageTitle = step === 'phone' || step === 'sms' ? 'Your phone number'
    : step === 'email' || step === 'email-code' ? 'Verify your email' : 'Your name';
  const stageBody = step === 'phone'
    ? 'Sign in or create an account with a one-time SMS code.'
    : step === 'sms'
      ? `Enter the code sent to ${maskPhone(phoneNumber)}.`
      : step === 'email'
        ? 'Add your email and create a password, then verify your email.'
        : step === 'email-code'
          ? `Enter the verification code sent to ${email.trim()}.`
          : 'Your phone and email are verified. What should we call you?';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Linea" />
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 22,
          paddingTop: 26,
          paddingBottom: Math.max(insets.bottom, 20) + 28,
        }}
        bottomOffset={80}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.mark, { backgroundColor: colors.primary }]}>
          <Feather name="phone" size={24} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{stageTitle}</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{stageBody}</Text>

        {step === 'phone' ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Mobile number</Text>
            <View style={[styles.phoneRow, { borderColor: colors.border, backgroundColor: colors.input }]}>
              <Pressable
                testID="phone-country"
                accessibilityRole="button"
                accessibilityLabel={`Country ${country.name}, ${country.dial}`}
                onPress={() => setCountryPickerOpen(true)}
                style={styles.countryButton}
              >
                <Text style={styles.flag}>{flagFor(country.code)}</Text>
                <Text style={[styles.dial, { color: colors.foreground }]}>{country.dial}</Text>
                <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
              </Pressable>
              <TextInput
                testID="phone-number-input"
                value={nationalNumber}
                onChangeText={(value) => setNationalNumber(value.replace(/[^\d\s().-]/g, ''))}
                placeholder="Mobile number"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                style={[styles.input, { color: colors.foreground }]}
                accessibilityLabel="Mobile phone number"
              />
            </View>
            <Text style={[styles.helper, { color: colors.mutedForeground }]}>
              We’ll send a code by SMS. Message charges may apply.
            </Text>
            <Text style={[styles.helper, { color: colors.mutedForeground }]}>
              On a Twilio trial, the recipient number must first be verified in Twilio.
            </Text>
            {!phoneReady ? (
              <Text style={[styles.helper, { color: colors.destructive }]}>
                {readiness.isLoading
                  ? 'Checking phone verification…'
                  : readiness.data?.message ?? 'Phone verification status is unavailable. Please try again later.'}
              </Text>
            ) : null}
          </View>
        ) : null}

        {step === 'sms' ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>SMS code</Text>
            <TextInput
              testID="phone-code-input"
              value={smsCode}
              onChangeText={(value) => setSmsCode(value.replace(/\D/g, '').slice(0, 10))}
              placeholder="Enter verification code"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              maxLength={10}
              style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input }]}
              accessibilityLabel="SMS verification code"
            />
            <Pressable
              testID="resend-phone-code"
              disabled={busy}
              onPress={async () => {
                setError('');
                try {
                  const result = await startPhone.mutateAsync({ data: { phoneNumber } });
                  setChallengeId(result.challengeId);
                  setSmsCode('');
                } catch (requestError) {
                  setError(safeError(requestError, 'We could not send another code. Please wait and try again.'));
                }
              }}
              style={styles.textAction}
            >
              <Text style={{ color: colors.primary, fontFamily: F.s }}>Resend SMS code</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 'email' ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Email address</Text>
            <TextInput
              testID="signup-email-input"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input }]}
              accessibilityLabel="Email address"
            />
            <Text style={[styles.label, { color: colors.foreground, marginTop: 16 }]}>Password</Text>
            <TextInput
              testID="signup-password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
              style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input }]}
              accessibilityLabel="Create password"
            />
            <View nativeID="clerk-captcha" />
          </View>
        ) : null}

        {step === 'email-code' ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Email verification code</Text>
            <TextInput
              testID="email-code-input"
              value={emailCode}
              onChangeText={(value) => setEmailCode(value.replace(/\D/g, '').slice(0, 10))}
              placeholder="Enter verification code"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={10}
              style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input }]}
              accessibilityLabel="Email verification code"
            />
            <Pressable
              testID="resend-email-code"
              onPress={async () => {
                setError('');
                const { error: sendError } = await signUp.verifications.sendEmailCode();
                if (sendError) setError(safeError(sendError, 'We could not send another email code.'));
              }}
              style={styles.textAction}
            >
              <Text style={{ color: colors.primary, fontFamily: F.s }}>Send another email code</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 'name' ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Full name</Text>
            <TextInput
              testID="signup-name-input"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
              textContentType="name"
              style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input }]}
              accessibilityLabel="Your name"
            />
          </View>
        ) : null}

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.card, borderColor: colors.destructive }]}>
            <Feather name="alert-circle" size={17} color={colors.destructive} />
            <Text style={{ flex: 1, color: colors.foreground, fontFamily: F.r, fontSize: 13, lineHeight: 19 }}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Btn
            label={busy
              ? 'Please wait'
              : step === 'phone' ? 'Text me a code'
                : step === 'sms' ? 'Verify phone'
                  : step === 'email' ? 'Send email code'
                    : step === 'email-code' ? 'Verify email' : 'Create account'}
            onPress={() => {
              if (step === 'phone') void beginPhoneVerification();
              else if (step === 'sms') void verifyPhoneCode();
              else if (step === 'email') void sendEmailCode();
              else if (step === 'email-code') void verifyEmailCode();
              else void finishSignup();
            }}
            disabled={busy || (step === 'phone' && !phoneReady)}
            testID={`auth-submit-${step}`}
          />
          {busy ? <ActivityIndicator color={colors.primary} style={{ marginTop: 14 }} /> : null}
          {step !== 'phone' ? (
            <Pressable
              testID="auth-change-phone"
              onPress={() => void changePhone()}
              style={styles.textAction}
            >
              <Text style={{ color: colors.mutedForeground, fontFamily: F.m }}>Use a different phone number</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAwareScrollViewCompat>

      <Modal visible={countryPickerOpen} animationType="slide" onRequestClose={() => setCountryPickerOpen(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background, paddingTop: insets.top + 10 }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Choose your country</Text>
            <Pressable
              testID="close-country-picker"
              onPress={() => setCountryPickerOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close country picker"
              hitSlop={12}
            >
              <Feather name="x" size={24} color={colors.foreground} />
            </Pressable>
          </View>
          <View style={[styles.searchBox, { backgroundColor: colors.card }]}>
            <Feather name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              testID="country-search"
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Search country or dial code"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              style={[styles.searchInput, { color: colors.foreground }]}
            />
          </View>
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                testID={`phone-country-${item.code}`}
                onPress={() => {
                  setCountryCode(item.code);
                  setCountryPickerOpen(false);
                  setCountrySearch('');
                }}
                style={[styles.countryItem, { borderBottomColor: colors.border }]}
              >
                <Text style={styles.flag}>{flagFor(item.code)}</Text>
                <Text numberOfLines={1} style={[styles.countryName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.dial, { color: colors.mutedForeground }]}>{item.dial}</Text>
                {item.code === countryCode ? <Feather name="check" size={18} color={colors.primary} /> : null}
              </Pressable>
            )}
            ListEmptyComponent={<Text style={{ color: colors.mutedForeground, textAlign: 'center', padding: 24 }}>No country found.</Text>}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  mark: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontFamily: F.b, fontSize: 28, letterSpacing: -0.4 },
  body: { fontFamily: F.r, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 30 },
  fieldGroup: { gap: 9 },
  label: { fontFamily: F.s, fontSize: 14 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12 },
  countryButton: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingRight: 12, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#55575D' },
  flag: { fontSize: 22, lineHeight: 28 },
  dial: { fontFamily: F.s, fontSize: 14 },
  input: { flex: 1, minHeight: 50, marginLeft: 12, fontFamily: F.r, fontSize: 16 },
  textInput: { minHeight: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, fontFamily: F.r, fontSize: 16 },
  helper: { fontFamily: F.r, fontSize: 12, lineHeight: 18, marginTop: 1 },
  actions: { marginTop: 28 },
  textAction: { alignSelf: 'center', paddingVertical: 15 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 18 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  modalTitle: { fontFamily: F.b, fontSize: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 18, marginBottom: 10, paddingHorizontal: 14, borderRadius: 14, minHeight: 48 },
  searchInput: { flex: 1, minHeight: 48, fontFamily: F.r, fontSize: 15 },
  countryItem: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  countryName: { flex: 1, fontFamily: F.m, fontSize: 15 },
});
