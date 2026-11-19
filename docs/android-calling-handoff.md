# Android calling: current boundary and remaining work

## Current release

The Linea Expo Go preview and email/password authentication stay intact.
**No real call can currently be placed or received. No calling APK is supplied.**
SMS composition still saves locally; live SMS delivery is separate work.

The API deliberately refuses Voice access tokens and rejects inbound/outbound
Voice webhooks even when their signatures are valid. Do not toggle a flag or
repoint a Twilio number to bypass this.

### Prepared and tested here

- Stable customer identities derived from the authenticated Clerk customer.
- Ownership checks for operator-provisioned customer-number assignments.
- Short-lived Voice token generation as an offline primitive.
- Canonical webhook URLs and Twilio signature validation.
- Incoming TwiML targeting only the assigned customer's SDK identity.
- Outgoing TwiML using only that customer's assigned caller ID.
- Both routing builders require a matching, unexpired server-side spending
  reservation for the specific customer, provider Call SID, direction, local
  number and remote number. Dial duration is capped at the reserved seconds.
- Invalid, revoked, cross-customer, blocked-destination and expired inputs reject
  without dialing.
- The call screen reads current setup blockers from the API and can refresh them.

**Not implemented:** creation/settlement of those spending reservations, SDK device
registration, native call UI, real audio, push delivery or customer number
provisioning. The TwiML builders are not called by live routes.

## Required Android build setup

1. Confirm an approved custom Android build service and project that can compile
   this repository. The current Replit preview is not an APK compiler.
2. Preserve the installed Expo 58 / React Native 0.88 versions and package
   identifiers. Do not downgrade or replace the Expo Go preview to make a build.
3. Verify Twilio Voice React Native SDK compatibility using the native build.
   Twilio's published 1.8.0 verification matrix lists Expo 52–57, not Expo 58.
   Newer versions are described as untested, not categorically unsupported.
4. In the custom native build, the Twilio Voice SDK and its Expo config plugin
   must be integrated, including Android microphone/notification permissions.
   Do not import the native SDK into the Expo Go bundle.
5. Register the final Android application ID with Firebase. Include its matching
   `google-services.json` in the native build through an approved configuration
   flow. Never paste service-account credentials into chat or commit them.
6. Configure Firebase Cloud Messaging and create the matching Twilio Android
   push credential. The SDK must register the authenticated customer's Voice
   identity and unregister on logout/account changes.

## Server and Twilio configuration

Use secure server-side configuration only. Never expose these settings in
`EXPO_PUBLIC_*` values:

| Setting | Purpose |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | Existing Twilio account |
| `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET` | Existing matched Standard key pair; verify Voice token signing support |
| `TWILIO_AUTH_TOKEN` | Verify webhook signatures; not an API-key secret |
| `TWILIO_VOICE_APPLICATION_SID` | TwiML application's `AP…` identifier |
| `TWILIO_VOICE_ANDROID_PUSH_CREDENTIAL_SID` | Android Firebase push credential's `CR…` identifier |
| `VOICE_WEBHOOK_ORIGIN` | Stable published HTTPS origin, not a temporary preview address |

Presence/format checks in readiness do **not** verify those resources with Twilio.
Do not replace working messaging/pricing keys or request duplicates unnecessarily.

The future Voice application will use `/api/voice/webhooks/outgoing`; assigned
numbers will use `/api/voice/webhooks/incoming`. Do not change Twilio routing until
the hard-disabled handlers have been replaced and the protections below verified.

## Backend work before enabling calls

- Verify number ownership with Twilio and customer entitlement before assigning a
  number. Never derive ownership from a client-supplied phone number.
- Atomically reserve funded credit in the wallet and enforce per-customer
  concurrency limits before generating connectable TwiML. For incoming calls,
  budget both provider legs as applicable; check rates rather than assuming free.
- Authorize destinations server-side (country permissions, trial recipients,
  emergency/premium/high-risk restrictions). No unrestricted public call API.
- Deduplicate webhook retries by provider Call SID; allow no second reservation
  for the same call. A reservation must not authorize a different call.
- Settle the reservation exactly once from signed provider status callbacks,
  release unused credit and prevent out-of-order callbacks from double-charging.
- Apply the approved 3× rate policy and billing-country currency conversion using
  verified provider rates. Reject calls when rates or funding are unavailable.
- Require completed customer accounts; never accept an identity/caller ID override
  from the app. Register/unregister native devices on session changes.
- Keep auth sessions in appropriate secure native storage for installed use.

## Real-device acceptance checks

Only run paid tests after explicit approval and a stated spending limit. Twilio
trial restrictions still apply. Testing requires an installed native build, a
Twilio-owned assigned number and a second phone/line.

1. Sign in by email, register the Android device and grant required permissions.
2. Call an approved test recipient. Verify two-way audio, ringing/connected/ended
   states, mute, speaker, hang-up and the assigned caller ID.
3. Call the assigned Twilio number from the second line. Verify the correct
   customer's phone rings, can answer/decline and has two-way audio.
4. Repeat incoming calls with the app in the background and the screen locked.
5. Check cancellation, busy, missed call, network loss and permission-denied paths.
6. Verify logout and account switching stop the previous customer's call delivery.
7. Confirm insufficient funds, disallowed destinations, simultaneous call attempts,
   webhook retries and forged ownership/signatures cannot spend credit.
8. Reconcile the wallet against actual Twilio call durations and both call legs.

## References

- https://github.com/twilio/twilio-voice-react-native
- https://github.com/twilio/twilio-voice-react-native/blob/main/docs/expo/app-config.md
- https://www.twilio.com/docs/voice/sdks/react-native

Documentation and package compatibility must be rechecked when a custom build
route becomes available. No cloud build, account routing change or billable
call was initiated while preparing this handoff.
