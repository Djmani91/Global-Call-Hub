import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth, useClerk, useUser, useSignIn, useSignUp } from '@clerk/expo';
import {
  useCompleteCustomerRegistration,
  setAuthTokenGetter,
  useGetCustomerAuthMe,
  getGetCustomerAuthMeQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Btn, F, ScreenHeader } from '@/components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Step = 'email' | 'email-code' | 'name';

function safeError(error: unknown, fallback: string) {
  const value = error as {
    errors?: Array<{ longMessage?: string; message?: string }>;
    message?: string;
    name?: string;
    data?: { error?: string };
  };
  if (value?.name === 'ApiError' && typeof value.data?.error === 'string') return value.data.error;
  const clerkMessage = value?.errors?.find((item) => item.longMessage || item.message);
  return clerkMessage?.longMessage ?? clerkMessage?.message ?? fallback;
}

export default function CustomerAuth() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn, userId } = useAuth();
  const clerk = useClerk();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { signIn } = useSignIn();
  const { signUp, fetchStatus: signUpFetchStatus } = useSignUp();
  const { setProfile, profile } = useApp();
  const completeRegistration = useCompleteCustomerRegistration();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);
  const account = useGetCustomerAuthMe({
    query: { queryKey: [...getGetCustomerAuthMeQueryKey(), userId], enabled: !!isSignedIn, retry: false },
  });

  const busy = submitting || completeRegistration.isPending || signUpFetchStatus === 'fetching';

  useEffect(() => {
    if (isSignedIn && account.data?.customer) router.replace('/(tabs)');
  }, [isSignedIn, account.data?.customer]);
  useEffect(() => {
    if (!isSignedIn || !account.data || account.data.customer || !user) return;
    const primaryEmail = user.primaryEmailAddress;
    if (primaryEmail?.verification.status !== 'verified') return;
    setEmail(primaryEmail.emailAddress);
    setFullName([user.firstName, user.lastName].filter(Boolean).join(' '));
    setStep('name');
  }, [
    isSignedIn,
    account.data,
    account.data?.customer,
    user?.id,
    user?.primaryEmailAddress?.emailAddress,
    user?.primaryEmailAddress?.verification.status,
    user?.firstName,
    user?.lastName,
  ]);
  useEffect(() => {
    if (!emailCooldown) return;
    const timer = setTimeout(() => {
      setEmailCooldown(value => Math.max(0, value - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [emailCooldown]);

  async function sendEmailCode() {
    setError('');
    if (!email.trim() || password.length < 8) {
      setError('Enter your email and a password with at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const { error: createError } = await signUp.password({
        emailAddress: email.trim(),
        password,
      });
      if (createError) {
        // Existing identities must prove ownership; never merge by matching email.
        const identifierExists = (createError as { errors?: Array<{ code?: string }> }).errors
          ?.some(item => item.code === 'form_identifier_exists');
        if (!identifierExists) throw createError;
        const { error: loginError } = await signIn.password({ emailAddress: email.trim(), password });
        if (loginError) throw loginError;
        if (signIn.status !== 'complete') {
          setError('This existing account needs additional sign-in verification before it can be linked.');
          return;
        }
        const finalized = await signIn.finalize({ navigate: () => undefined });
        if (finalized.error) throw finalized.error;
        const existingUser = await clerk.user?.reload();
        if (existingUser?.primaryEmailAddress?.verification.status !== 'verified') {
          setError('Verify the existing account’s email before continuing.');
          return;
        }
        setFullName([existingUser.firstName, existingUser.lastName].filter(Boolean).join(' '));
        setPassword('');
        setStep('name');
        return;
      }
      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) throw sendError;
      setPassword('');
      setEmailCooldown(60);
      setStep('email-code');
    } catch (requestError) {
      setError(safeError(requestError, 'We could not send the email code. Check your email and try again.'));
    } finally { setSubmitting(false); }
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
    setSubmitting(true);
    try {
      if (clerk.user) {
        await clerk.user.update({ firstName, lastName });
      } else {
        const { error: updateError } = await signUp.update({ firstName, lastName });
        if (updateError) throw updateError;
        if (signUp.status !== 'complete') {
          throw new Error('Your signup is missing a required detail.');
        }
        const finalized = await signUp.finalize({ navigate: () => undefined });
        if (finalized.error) throw finalized.error;
      }
      if (Platform.OS !== 'web') setAuthTokenGetter(() => clerk.session?.getToken() ?? Promise.resolve(null));
      await completeRegistration.mutateAsync({ data: {} });
      await queryClient.invalidateQueries({ queryKey: getGetCustomerAuthMeQueryKey() });
      setProfile({
        ...profile,
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
      });
      router.replace('/(tabs)');
    } catch (requestError) {
      setError(safeError(requestError, 'Your account could not be completed. Please try again.'));
    } finally { setSubmitting(false); }
  }

  async function changeEmail() {
    setError('');
    setEmailCode('');
    setPassword('');
    setStep('email');
    try { await signUp.reset(); } catch {}
  }

  const stageTitle = step === 'email' ? 'Sign in or create an account'
    : step === 'email-code' ? 'Verify your email' : 'Your name';
  const stageBody = step === 'email'
    ? 'Use your email and password. New accounts verify email before continuing.'
    : step === 'email-code'
      ? `Enter the verification code sent to ${email.trim()}.`
      : 'Your email is verified. What should we call you?';

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
          <Feather name="mail" size={24} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{stageTitle}</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{stageBody}</Text>
        {isSignedIn && account.isError ? (
          <Pressable onPress={() => void account.refetch()} style={styles.textAction}>
            <Text style={{ color: colors.primary }}>Could not load your account. Tap to retry.</Text>
          </Pressable>
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
              disabled={busy || emailCooldown > 0}
              onPress={async () => {
                setError('');
                try {
                  const { error: sendError } = await signUp.verifications.sendEmailCode();
                  if (sendError) throw sendError;
                  setEmailCooldown(60);
                } catch (sendError) { setError(safeError(sendError, 'We could not send another email code.')); }
              }}
              style={styles.textAction}
            >
              <Text style={{ color: emailCooldown ? colors.mutedForeground : colors.primary, fontFamily: F.s }}>
                {emailCooldown ? `Resend email in ${emailCooldown}s` : 'Send another email code'}
              </Text>
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
              : step === 'email' ? 'Continue with email'
                : step === 'email-code' ? 'Verify email' : 'Create account'}
            onPress={() => {
              if (step === 'email') void sendEmailCode();
              else if (step === 'email-code') void verifyEmailCode();
              else void finishSignup();
            }}
            disabled={busy}
            testID={`auth-submit-${step}`}
          />
          {busy ? <ActivityIndicator color={colors.primary} style={{ marginTop: 14 }} /> : null}
          {step === 'email-code' && !isSignedIn ? (
            <Pressable
              testID="auth-change-email"
              onPress={() => void changeEmail()}
              style={styles.textAction}
            >
              <Text style={{ color: colors.mutedForeground, fontFamily: F.m }}>Use a different email</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAwareScrollViewCompat>
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
  textInput: { minHeight: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, fontFamily: F.r, fontSize: 16 },
  actions: { marginTop: 28 },
  textAction: { alignSelf: 'center', paddingVertical: 15 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 18 },
});
