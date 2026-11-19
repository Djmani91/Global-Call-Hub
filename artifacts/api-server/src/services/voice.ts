import { createHash } from "node:crypto";
import twilio from "twilio";

// This is intentionally NOT an environment flag. Enabling voice requires reviewed code,
// a supported native build, account setup, and atomic spend/concurrency controls.
export const VOICE_ENABLED = false;
export const VOICE_TOKEN_TTL_SECONDS = 300;
export const VOICE_DISABLED_MESSAGE =
  "Calling is disabled. Expo Go cannot make or receive Twilio Voice calls. Installed builds, push setup and spending controls must be verified first.";
// Configuration presence is not proof of provider permissions or device delivery.
// Never return credentials or turn calling on just because these checks pass.
export function getVoiceReadiness(env: NodeJS.ProcessEnv = process.env) {
  const blockers = [
    "A custom Android build with the Twilio Voice SDK is still required; Expo Go cannot run it.",
    "Expo 58 / React Native 0.88 compatibility still needs an installed-build check.",
    "A Twilio-owned number must be assigned to the signed-in customer before calling.",
    "Atomic credit reservations, usage charging, rate limits and concurrent-call limits are not connected.",
    "Real-device outgoing audio and incoming ringing must pass foreground, background and locked-phone tests.",
  ];
  if (!/^AC[0-9a-f]{32}$/i.test(env.TWILIO_ACCOUNT_SID?.trim() ?? "")) {
    blockers.push("The Twilio Account SID is missing or has an invalid format.");
  }
  if (!/^SK[0-9a-f]{32}$/i.test(env.TWILIO_API_KEY_SID?.trim() ?? "") || !env.TWILIO_API_KEY_SECRET) {
    blockers.push("The existing Twilio API key pair is missing or has an invalid format.");
  }
  if (!/^AP[0-9a-f]{32}$/i.test(env.TWILIO_VOICE_APPLICATION_SID?.trim() ?? "")) {
    blockers.push("The Twilio Voice application is not configured.");
  }
  if (!env.TWILIO_AUTH_TOKEN) {
    blockers.push("Twilio webhook signature verification is not configured.");
  }
  if (!canonicalWebhookUrl(env.VOICE_WEBHOOK_ORIGIN, "/api/voice/webhooks/incoming")) {
    blockers.push("The stable public Voice webhook address is not configured.");
  }
  if (!/^CR[0-9a-f]{32}$/i.test(env.TWILIO_VOICE_ANDROID_PUSH_CREDENTIAL_SID?.trim() ?? "")) {
    blockers.push("Android Firebase/FCM incoming-call credentials are not configured.");
  }
  blockers.push("Provider key permissions, Voice application URLs and Firebase device registration still need verification.");
  return {
    enabled: VOICE_ENABLED,
    expoGoSupported: false as const,
    message: VOICE_DISABLED_MESSAGE,
    blockers,
  };
}

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
