import { createHash } from "node:crypto";
import twilio from "twilio";

// This is intentionally NOT an environment flag. Enabling voice requires reviewed code,
// a supported native build, account setup, and atomic spend/concurrency controls.
export const VOICE_ENABLED = false;
export const VOICE_TOKEN_TTL_SECONDS = 300;
export const VOICE_DISABLED_MESSAGE =
  "Calling is disabled. Expo Go cannot make or receive Twilio Voice calls. Installed builds, push setup and spending controls must be verified first.";
export const voiceReadiness = {
  enabled: VOICE_ENABLED,
  expoGoSupported: false as const,
  message: VOICE_DISABLED_MESSAGE,
  blockers: [
    "Twilio's published compatibility matrix does not verify Expo 58 / React Native 0.88.",
    "An approved custom native build route is required for Android and iPhone.",
    "Customer sign-in UI and verified customer-to-number assignments are not connected.",
    "TwiML application, account Auth Token and a supported token-signing key must be verified.",
    "Apple VoIP/APNs and Android Firebase/FCM credentials and device registration are not verified.",
    "Atomic credit reservation, destination restrictions, rate limits and concurrency limits are required before enabling calls.",
    "Foreground, background and locked-device calling must be tested on real devices.",
  ],
};

export function voiceIdentity(customerId: string): string {
  if (!customerId) throw new Error("Authenticated customer required");
  return `linea_${createHash("sha256").update(customerId).digest("hex")}`;
}

export type Assignment = { customerId: string; phoneNumber: string; revokedAt: Date | null };
export function ownedCallerId(customerId: string, phoneNumber: string, assignment: Assignment | null): string | null {
  return customerId && assignment && assignment.customerId === customerId &&
    assignment.phoneNumber === phoneNumber && !assignment.revokedAt &&
    /^\+[1-9]\d{7,14}$/.test(phoneNumber) ? assignment.phoneNumber : null;
}

export function incomingIdentity(phoneNumber: string, assignment: Assignment | null): string | null {
  return assignment && ownedCallerId(assignment.customerId, phoneNumber, assignment)
    ? voiceIdentity(assignment.customerId) : null;
}

type SigningConfig = {
  accountSid: string; apiKeySid: string; apiKeySecret: string;
  applicationSid: string; pushCredentialSid: string;
};

// Offline preparation primitive, never called by HTTP routes in this release.
// Only a verified server session can supply customerId; never a request body.
export function buildPreparedVoiceToken(customerId: string, config: SigningConfig): string {
  if (!/^AC[0-9a-f]{32}$/i.test(config.accountSid) ||
      !/^SK[0-9a-f]{32}$/i.test(config.apiKeySid) ||
      !/^AP[0-9a-f]{32}$/i.test(config.applicationSid) ||
      !/^CR[0-9a-f]{32}$/i.test(config.pushCredentialSid) || !config.apiKeySecret) {
    throw new Error("Verified Voice signing configuration required");
  }
  const token = new twilio.jwt.AccessToken(config.accountSid, config.apiKeySid, config.apiKeySecret, {
    identity: voiceIdentity(customerId), ttl: VOICE_TOKEN_TTL_SECONDS,
  });
  token.addGrant(new twilio.jwt.AccessToken.VoiceGrant({
    outgoingApplicationSid: config.applicationSid,
    incomingAllow: true,
    pushCredentialSid: config.pushCredentialSid,
  }));
  return token.toJwt();
}

// Use a configured origin, never Host/X-Forwarded-Host supplied by the caller.
export function canonicalWebhookUrl(origin: string | undefined, originalUrl: string): string | null {
  if (!origin || !/^\/api\/voice\/webhooks\/(incoming|outgoing)$/.test(originalUrl)) return null;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash) return null;
    return `${url.origin}${originalUrl}`;
  } catch { return null; }
}

export function validVoiceSignature(authToken: string, signature: string, url: string, body: Record<string, string>): boolean {
  try { return !!authToken && !!signature && twilio.validateRequest(authToken, signature, url, body); }
  catch { return false; }
}
