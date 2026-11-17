# Android credit purchases

## Current release: safe preparation, not live billing

The user confirmed a fixed **GBP wallet** and **£5, £10 and £15** credit packs.
Google Play Console configuration is deliberately deferred until after app upload.
No real charges were made. No Android application identifier was invented or changed;
`expo.android.package` is currently absent. No Apple billing catalog was created.

The connected RevenueCat project contains consumable Test Store products and the
`linea_credit_gbp` offering. Product titles and checkout prices come from the SDK's
current offering. Its `credit_packs` metadata maps store identifiers to **credited
GBP minor units**, not the localized amount Google charges. There are no local
catalog tables. Number/voice/SMS prices still follow the separate Twilio ×3 policy.

## Preview

Open **Credit → See top-up options**. Select a provider-priced pack and confirm the
custom test confirmation. Browser/Expo Go always use the Test Store key regardless
of production configuration. Anonymous preview checkout may exercise RevenueCat's
test UI but adds **no wallet credit**. Preview API Mode may use mocked native
responses: it does not prove store payment validation.

Signed-in sandbox purchases, once the existing customer-auth work is connected,
can be reconciled to a separate test balance. They can never become production
funds, pay Twilio, or purchase a number. Number purchase remains disabled.

## Authentication hand-off

The upstream release supplied Clerk verification on the server, **not a working
mobile sign-in screen**. That work remains in the existing sign-in task.
Do not introduce another login system or use the editable local demo profile.

Once the existing auth provider is mounted:

1. Pass Clerk's current `userId` (or null on sign-out) into `BillingProvider`.
2. Use the shared generated-client `setAuthTokenGetter` with Clerk's `getToken`.
3. Reset customer-scoped caches at sign-out/account switching. Billing query keys
   already include the supplied session ID and reject mismatched response IDs.
4. The provider validates the live backend identity immediately before checkout
   and after success. RevenueCat logs in with that same canonical customer ID.
5. Never call a client API to set balance, value, purchase owner, transaction ID,
   or billing currency. No such server endpoint exists.

Real checkout additionally requires installed Android, the explicit production
client mode and server readiness. Merely setting a local profile cannot unlock it.

## Accounting and verification

- `/api/billing/wallet`: Clerk-authenticated balance and latest 100 ledger entries.
  Balances sum the entire durable ledger, not just those 100 entries.
- `/api/billing/reconcile`: authenticated, input-free RevenueCat refresh. Retries
  and returning from interruption are safe. A client success never grants money.
- `/api/billing/webhook`: exact constant-time authorization-header check. Configure
  a high-entropy header of at least 32 characters through Secrets; never in chat,
  source, logs or the mobile app. The webhook event is only a notification: credit
  comes from an independent connector-authenticated RevenueCat purchases read.
- Project, app, store, environment, customer/original owner, settled status,
  consumable type, quantity and provider metadata are checked. Foreign, anonymous,
  transferred, pending, failed and unrecognized receipts cannot credit a wallet.
- Customer advisory locks and atomic database transactions serialize reconciliation.
  Store/environment/transaction uniqueness prevents replay. Existing monetary
  facts are immutable when a product's metadata changes.
- Full verified refunds reverse a previous credit exactly once. A refund received
  before purchase never credits/debits money. Refund is terminal: late success
  and refund-reversed notifications cannot automatically re-credit; resolve those
  exceptional cases through a reviewed adjustment policy before supporting them.
- Existing production refunds continue to work when new checkout is disabled.
  A negative balance is retained as debt, never silently clamped. Usage spending
  and debt enforcement are outside this release.
- Keep RevenueCat purchase transfers disabled for wallet products; aliases do not
  authorize ownership changes. Do not delete historical metadata/products needed
  for verification. Unexpected ownership or malformed provider data fails closed
  and rolls the entire reconciliation back.
- No webhook payloads, secret headers or customer data are logged. Failed
  reconciliation returns retryable 503; webhook is not acknowledged as success.

## Setup later, before any real checkout

1. Resolve the app's permanent Android package identifier with the owner; do not
   change an existing identifier. Set up the actual app/upload in Google Play
   using the owner's supported Android release process. This task does not run
   native builds, prebuild or EAS commands. Expo Go cannot test Google Play billing.
2. Run `pnpm --filter @workspace/scripts exec tsx src/seedRevenueCat.ts` to inspect,
   then `--apply` to seed missing resources. It reuses existing Linea resources and
   never creates an iOS app. Once an Android package exists, it also creates/reuses
   that Play app and consumables. Seed metadata must not silently overwrite any
   pre-existing unrelated current offering.
3. Create/activate Google Play **one-time consumable** products using the identifiers
   `linea_credit_gbp_5`, `linea_credit_gbp_10`, `linea_credit_gbp_15`.
   These are NOT subscriptions and have no `:basePlanId`.
   Configure the actual regional paid prices in Google Play; the offering metadata
   always states the fixed GBP credit delivered, independent of taxes/FX/store fees.
4. Connect the correct Google Play app/service-account configuration in RevenueCat.
   Attach each Play product to its matching offering package. Fetch its **public**
   Android SDK key and save it as `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`.
   Set `REVENUECAT_GOOGLE_PLAY_STORE_APP_ID` to that exact provider app ID.
   Do not put Google credentials or a RevenueCat secret API key in Expo.
5. Configure RevenueCat webhook URL at the actual deployed HTTPS API's
   `/api/billing/webhook`, with `REVENUECAT_WEBHOOK_AUTHORIZATION` through Secrets.
   Confirm delivery/retries and connector availability in the deployed environment.
   Apply the new database schema in the target environment before enabling billing.
6. Finish the existing mobile sign-in task and validate account switching. Use
   **Keep with original App User ID** transfer behavior for wallet purchases.
7. In a configured installed Google Play internal-test build, with license testers,
   verify purchase, repeated consumable top-up, pending approval, cancellation,
   interruption/relaunch, refunds, duplicate events, sign-out and a second account.
   Verify the actual RevenueCat store/environment fields. Test or license-test
   transactions must remain sandbox and nonspendable.
8. Only after those checks, set `EXPO_PUBLIC_LINEA_BILLING_MODE=production` for the
   intended Android binary and `LINEA_PLAY_BILLING_ENABLED=true` on its server.
   Browser/Expo Go remain test-only, and iOS real checkout stays unsupported.
   Missing products/offerings/keys/session/readiness always block real checkout.

## Verification commands and limits

- `pnpm --filter @workspace/api-server run test:credits`
  exercises canonical identity, store/environment separation, pending/failed
  rejection, replay, refunds, account isolation, actual PostgreSQL ledger writes
  in a rolled-back transaction, Clerk signature verification and webhook auth.
- Workspace type checks and mobile JavaScript export checks.
- Focused browser Test Store checkout/cancellation checks, with no real charges.

These checks do **not** establish production Google billing, Play service-account
readiness, physical Android payment-sheet behavior, fraud operations, partial-refund
policy, or real native build compatibility. There is no entitlement/subscription
restore button: consumed credit is recovered from the server ledger after sign-in,
not granted again by `restorePurchases()`.

The focused Expo dependency assessment reports existing recommendations for
`@types/react-dom`, `react-native` and `react-native-safe-area-context`. This
purchase change preserves the installed SDK and those unrelated version pins;
successful JavaScript exports do not resolve those native compatibility gaps.
