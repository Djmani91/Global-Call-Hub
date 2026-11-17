import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, { PURCHASES_ERROR_CODE, type PurchasesPackage, type PurchasesOffering } from 'react-native-purchases';
import { useQuery } from '@tanstack/react-query';
import {
  getCreditWallet, useGetBillingReadiness, useGetCreditWallet, useReconcileCreditWallet,
  getGetBillingReadinessQueryKey, getGetCreditWalletQueryKey,
} from '@workspace/api-client-react';

type Pack = { package: PurchasesPackage; creditMinor: number; currency: 'GBP' };
function useBillingState(sessionCustomerId: string | null) {
  const readiness = useGetBillingReadiness({ query: { queryKey: getGetBillingReadinessQueryKey(), retry: false, staleTime: 30_000 } });
  const walletQuery = useGetCreditWallet({ query: {
    queryKey: [...getGetCreditWalletQueryKey(), sessionCustomerId], enabled: !!sessionCustomerId,
    retry: false, refetchInterval: 30_000, staleTime: 0, gcTime: 0,
  } });
  // Never use stale customer data after an authorization failure.
  const wallet = !sessionCustomerId || walletQuery.isError || walletQuery.data?.customerId !== sessionCustomerId
    ? undefined : walletQuery.data;
  const reconcile = useReconcileCreditWallet();
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState('');
  const [storeAttempt, setStoreAttempt] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const preview = Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient';
  const testMode = preview || process.env.EXPO_PUBLIC_LINEA_BILLING_MODE !== 'production';
  const key = testMode ? process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY :
    Platform.OS === 'android' ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY : undefined;
  const customerId = wallet?.customerId;
  const installedAndroid = Platform.OS === 'android' && !preview;
  const canUseProduction = !testMode && installedAndroid && !!customerId && !!readiness.data?.productionEnabled;

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    setSdkReady(false);
    // Production SDK is never configured anonymously or on unsupported platforms.
    if (!key || (!testMode && !canUseProduction)) return;
    (async () => {
      if (!(await Purchases.isConfigured())) Purchases.configure({ apiKey: key, ...(customerId ? { appUserID: customerId } : {}) });
      else if (customerId && await Purchases.getAppUserID() !== customerId) await Purchases.logIn(customerId);
      else if (!customerId && !(await Purchases.isAnonymous())) await Purchases.logOut();
      if (!cancelled) { setSdkError(''); setSdkReady(true); }
    })().catch(() => { if (!cancelled) setSdkError('Store connection unavailable. Retry shortly.'); });
    return () => { cancelled = true; alive.current = false; };
  }, [key, customerId, testMode, canUseProduction, storeAttempt]);

  const offerings = useQuery({
    queryKey: ['linea-credit-offering', testMode, customerId ?? 'preview'],
    queryFn: () => Purchases.getOfferings(),
    enabled: sdkReady, retry: false, staleTime: 60_000,
  });
  const offering: PurchasesOffering | null = offerings.data?.current ?? null;
  const metadata = offering?.metadata as { wallet_currency?: string; credit_packs?: Record<string, { currency?: string; minor?: number }> } | undefined;
  const packs: Pack[] = (offering?.availablePackages ?? []).flatMap(pkg => {
    const credit = metadata?.credit_packs?.[pkg.product.identifier];
    return metadata?.wallet_currency === 'GBP' && credit?.currency === 'GBP' &&
      typeof credit.minor === 'number' && Number.isSafeInteger(credit.minor) && credit.minor > 0
      ? [{ package: pkg, creditMinor: credit.minor, currency: 'GBP' as const }] : [];
  }).sort((a, b) => a.creditMinor - b.creditMinor);

  async function refresh() {
    setMessage('');
    if (!sessionCustomerId) { setMessage('Sign in to check your purchases. Anonymous preview purchases never add wallet credit.'); return; }
    try { await reconcile.mutateAsync(); await walletQuery.refetch(); setMessage('Wallet checked against RevenueCat.'); }
    catch { await walletQuery.refetch(); setMessage('Verification is unavailable. No unverified credit was added. Sign in and try again later.'); }
  }
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        if (sessionCustomerId) void walletQuery.refetch();
        if (customerId) void reconcile.mutateAsync().then(() => walletQuery.refetch()).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [customerId, sessionCustomerId]);

  async function purchase(pack: Pack) {
    if (busy || !sdkReady || (!testMode && !canUseProduction)) return;
    setBusy(true); setMessage('');
    const startingCustomer = customerId;
    try {
      if (startingCustomer) {
        // Recheck the server identity immediately before invoking a real store sheet.
        const current = await getCreditWallet();
        if (current.customerId !== startingCustomer || await Purchases.getAppUserID() !== startingCustomer) {
          throw new Error('SESSION_CHANGED');
        }
      } else if (!testMode || !(await Purchases.isAnonymous())) throw new Error('SESSION_CHANGED');
      await Purchases.purchasePackage(pack.package);
      // A client success result never changes balance. Only server reconciliation can.
      if (startingCustomer) {
        const current = await getCreditWallet();
        if (current.customerId !== startingCustomer) throw new Error('SESSION_CHANGED');
        await reconcile.mutateAsync();
        await walletQuery.refetch();
      }
      setMessage(testMode ? 'Test purchase completed. This is not spendable credit or proof of Google Play billing.'
        : 'Purchase received. Your balance updates only after server verification. Tap Check purchases if it is delayed.');
    } catch (error) {
      const e = error as { code?: string; userCancelled?: boolean; message?: string };
      setMessage(e.userCancelled || e.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
        ? 'Purchase cancelled. No credit was added.'
        : e.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR
          ? 'Payment pending. Credit will appear only after the store confirms payment.'
          : e.message === 'SESSION_CHANGED' ? 'Your account changed. Refresh before purchasing.'
            : 'Purchase or verification was interrupted. No client-side credit was added. Check purchases before trying again.');
    } finally { if (alive.current) setBusy(false); }
  }
  return { wallet, walletLoading: walletQuery.isLoading, walletError: walletQuery.error, readiness: readiness.data,
    testMode, preview, packs, busy, message, purchase, refresh,
    refreshing: reconcile.isPending, sdkError,
    loading: offerings.isLoading && sdkReady,
    storeError: offerings.isError,
    canPurchase: sdkReady && (testMode || canUseProduction),
    reloadStore: () => {
      if (!sdkReady) { setStoreAttempt(n => n + 1); return; }
      void offerings.refetch().then(result => setMessage(result.isError ? 'Store options could not be refreshed.' : 'Store options refreshed.'));
    },
  };
}
type Billing = ReturnType<typeof useBillingState>;
// Metro's lazy routes/Fast Refresh may evaluate a context module again while
// an existing root still holds its previous Context object. Retain only the
// Context definition across those evaluations, never any wallet/customer data.
const contextRegistry = globalThis as typeof globalThis & {
  __lineaBillingContext?: React.Context<Billing | null>;
};
const BillingContext = contextRegistry.__lineaBillingContext ??= createContext<Billing | null>(null);
// Auth bridge supplies Clerk's userId and shared setAuthTokenGetter. A local profile
// or RevenueCat anonymous identifier must never be passed as a customer session.
export function BillingProvider({ children, customerId = null }: {
  children: React.ReactNode; customerId?: string | null;
}) {
  const value = useBillingState(customerId);
  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}
export function useBilling() {
  const value = useContext(BillingContext);
  if (!value) throw new Error('useBilling must be inside BillingProvider');
  return value;
}
