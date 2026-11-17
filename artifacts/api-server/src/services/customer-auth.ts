import { createHash, createHmac } from "node:crypto";

export type TwilioVerifyConfig = {
  apiKeySid: string;
  apiKeySecret: string;
  serviceSid: string;
};

export class VerifyProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly providerCode?: number,
  ) {
    super(message);
    this.name = "VerifyProviderError";
  }
}

export function twilioVerifyConfig(
  env: NodeJS.ProcessEnv = process.env,
): TwilioVerifyConfig | null {
  const apiKeySid = env.TWILIO_VERIFY_API_KEY_SID?.trim();
  const apiKeySecret = env.TWILIO_VERIFY_API_KEY_SECRET;
  const serviceSid = env.TWILIO_VERIFY_SERVICE_SID?.trim();
  if (
    !apiKeySid ||
    !/^SK[0-9a-f]{32}$/i.test(apiKeySid) ||
    !apiKeySecret ||
    !serviceSid ||
    !/^VA[0-9a-f]{32}$/i.test(serviceSid)
  ) {
    return null;
  }
  return { apiKeySid, apiKeySecret, serviceSid };
}

export function isValidE164(phoneNumber: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phoneNumber);
}

export function digestChallenge(challengeId: string): string {
  return createHash("sha256").update(challengeId).digest("hex");
}

export function digestRateLimitKey(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function verifiedPrimaryEmail(user: {
  primaryEmailAddressId: string | null;
  emailAddresses: Array<{
    id: string;
    emailAddress: string;
    verification: { status: string | null } | null;
  }>;
}): string | null {
  const primary = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  );
  if (!primary || primary.verification?.status !== "verified") return null;
  return primary.emailAddress.trim().toLowerCase();
}

export function isConfiguredAdmin(email: string | null, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!email) return false;
  const allowed = env.LINEA_ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(allowed && email.trim().toLowerCase() === allowed);
}

async function verifyRequest(
  config: TwilioVerifyConfig,
  resource: "Verifications" | "VerificationCheck",
  values: Record<string, string>,
  fetcher: typeof fetch = fetch,
): Promise<{ status?: string }> {
  const url = `https://verify.twilio.com/v2/Services/${encodeURIComponent(config.serviceSid)}/${resource}`;
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.apiKeySid}:${config.apiKeySecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams(values),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new VerifyProviderError("Twilio Verify is unreachable.", 503);
  }

  let body: { status?: string; code?: number } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    throw new VerifyProviderError("Twilio Verify returned an invalid response.", 503);
  }
  if (!response.ok) {
    throw new VerifyProviderError(
      "Twilio Verify rejected the request.",
      response.status,
      typeof body.code === "number" ? body.code : undefined,
    );
  }
  return body;
}

export async function startTwilioVerification(
  config: TwilioVerifyConfig,
  phoneNumber: string,
  fetcher?: typeof fetch,
): Promise<void> {
  await verifyRequest(
    config,
    "Verifications",
    { To: phoneNumber, Channel: "sms" },
    fetcher,
  );
}

export async function checkTwilioVerification(
  config: TwilioVerifyConfig,
  phoneNumber: string,
  code: string,
  fetcher?: typeof fetch,
): Promise<boolean> {
  const body = await verifyRequest(
    config,
    "VerificationCheck",
    { To: phoneNumber, Code: code },
    fetcher,
  );
  return body.status === "approved";
}
