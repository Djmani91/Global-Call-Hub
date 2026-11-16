import { Router, type IRouter } from "express";
import {
  GetTwilioAvailableNumbersQueryParams,
  GetTwilioAvailableNumbersResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const RESOURCE_BY_TYPE = {
  local: "Local",
  mobile: "Mobile",
  "toll-free": "TollFree",
} as const;

const CACHE_TTL_MS = 45_000;
const cache = new Map<
  string,
  { expiresAt: number; response: ReturnType<typeof GetTwilioAvailableNumbersResponse.parse> }
>();

router.get("/twilio/available-numbers", async (req, res): Promise<void> => {
  const parsed = GetTwilioAvailableNumbersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a supported country and number type." });
    return;
  }

  const { countryCode, phoneNumberType, search } = parsed.data;
  const cacheKey = `${countryCode}:${phoneNumberType}:${search ?? ""}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.json(cached.response);
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim();
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  if (!accountSid || !apiKeySid || !apiKeySecret) {
    res.status(503).json({ error: "Live number search is not configured on the server." });
    return;
  }

  const auth = Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64");
  const resource = RESOURCE_BY_TYPE[phoneNumberType];
  const url = new URL(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/AvailablePhoneNumbers/${countryCode}/${resource}.json`,
  );
  url.searchParams.set("PageSize", "20");
  if (search) {
    const isNorthAmericanAreaCode =
      (countryCode === "US" || countryCode === "CA") &&
      phoneNumberType !== "toll-free" &&
      search.length === 3;

    if (isNorthAmericanAreaCode) {
      url.searchParams.set("AreaCode", search);
    } else {
      url.searchParams.set("Contains", `%${search}%`);
    }
  }

  try {
    const upstream = await fetch(url, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    const body = (await upstream.json()) as {
      available_phone_numbers?: Array<{
        phone_number?: string;
        friendly_name?: string;
        locality?: string | null;
        region?: string | null;
        capabilities?: Record<string, boolean | undefined>;
      }>;
      code?: number;
    };

    if (!upstream.ok) {
      if (body.code === 8021) {
        req.log.warn({ countryCode, phoneNumberType, twilioCode: body.code }, "Twilio number search permission is missing");
        res.status(403).json({ error: "The Twilio key needs permission to search available phone numbers." });
        return;
      }
      if (body.code === 20003) {
        req.log.warn({ twilioCode: body.code }, "Twilio rejected the configured server credentials");
        res.status(503).json({ error: "Twilio rejected the server credentials. Check the key and account match." });
        return;
      }
      if (upstream.status === 429) {
        res.status(503).json({ error: "Twilio is receiving too many searches. Please try again shortly." });
        return;
      }
      req.log.warn(
        { status: upstream.status, twilioCode: body.code, countryCode, phoneNumberType },
        "Twilio number search failed",
      );
      res.status(502).json({ error: "Twilio could not complete the number search. Please try again." });
      return;
    }

    const response = GetTwilioAvailableNumbersResponse.parse({
      countryCode,
      phoneNumberType,
      fetchedAt: new Date().toISOString(),
      numbers: (body.available_phone_numbers ?? []).flatMap((item) => {
        if (!item.phone_number) return [];
        const capabilities = item.capabilities ?? {};
        return [{
          phoneNumber: item.phone_number,
          friendlyName: item.friendly_name ?? item.phone_number,
          locality: item.locality ?? null,
          region: item.region ?? null,
          capabilities: {
            voice: capabilities.voice ?? capabilities.Voice ?? false,
            sms: capabilities.SMS ?? capabilities.sms ?? false,
            mms: capabilities.MMS ?? capabilities.mms ?? false,
          },
        }];
      }),
    });

    if (cache.size >= 100) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, response });
    res.json(response);
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    req.log.warn({ countryCode, phoneNumberType, timedOut }, "Unable to reach Twilio number search");
    res.status(502).json({ error: "Could not reach Twilio. Please try again." });
  }
});

export default router;
