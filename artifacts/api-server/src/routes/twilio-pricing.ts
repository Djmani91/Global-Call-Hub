import { Router, type IRouter } from "express";
import { GetTwilioPricingQueryParams, GetTwilioPricingResponse } from "@workspace/api-zod";
import { BILLING_CURRENCIES, MULTIPLIER, customerAmount, exchangeRate, extractRates } from "../services/pricing";

const router: IRouter = Router();
const resources = { numbers: "v1/PhoneNumbers", voice: "v2/Voice", sms: "v1/Messaging" } as const;
const names = { numbers: "phone-number", voice: "voice", sms: "messaging" };
const cache = new Map<string, { expires: number; response: ReturnType<typeof GetTwilioPricingResponse.parse> }>();

router.get("/twilio/pricing", async (req, res): Promise<void> => {
  const parsed = GetTwilioPricingQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a supported destination and billing country." });
    return;
  }
  const { countryCode, billingCountry } = parsed.data;
  const currency = BILLING_CURRENCIES[billingCountry];
  const key = `${countryCode}:${billingCountry}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) { res.json(cached.response); return; }
  const sid = process.env.TWILIO_API_KEY_SID?.trim();
  const secret = process.env.TWILIO_API_KEY_SECRET?.trim();
  const sections = await Promise.all((Object.keys(resources) as Array<keyof typeof resources>).map(async kind => {
    const empty = { kind, error: null as string | null, sourceCurrency: null as string | null,
      exchangeRate: null as number | null, exchangeDate: null as string | null, rates: [] as unknown[] };
    try {
      if (!sid || !secret) throw new Error("Twilio pricing credentials are not configured on the server.");
      const upstream = await fetch(`https://pricing.twilio.com/${resources[kind]}/Countries/${countryCode}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${secret}`).toString("base64")}`, Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
      const body = await upstream.json() as Record<string, unknown>;
      if (!upstream.ok) {
        if (body.code === 8011 || body.code === 8021 || upstream.status === 403) {
          throw new Error(`Twilio ${names[kind]} pricing permission is missing. Enable pricing Read access on the server's restricted API key.`);
        }
        if (upstream.status === 401) throw new Error("Twilio rejected the pricing credentials. Check the configured key.");
        if (upstream.status === 404) throw new Error(`Twilio does not provide ${names[kind]} pricing for this country.`);
        throw new Error(`Twilio ${names[kind]} pricing is temporarily unavailable. Please retry.`);
      }
      const source = typeof body.price_unit === "string" ? body.price_unit.toUpperCase() : "";
      if (!/^[A-Z]{3}$/.test(source) || body.iso_country !== countryCode) throw new Error("Twilio returned invalid country pricing.");
      const raw = extractRates(kind, body);
      const fx = await exchangeRate(source, currency);
      return { ...empty, sourceCurrency: source, exchangeRate: fx.rate, exchangeDate: fx.date,
        rates: raw.map(({ cost, ...rate }) => ({ ...rate, amount: customerAmount(cost, fx.rate, rate.unit === "month" ? 2 : 6) })) };
    } catch (error) {
      return { ...empty, error: error instanceof Error ? error.message : "Pricing unavailable. Please retry." };
    }
  }));
  const response = GetTwilioPricingResponse.parse({ countryCode, billingCountry, currency,
    multiplier: MULTIPLIER, fetchedAt: new Date().toISOString(), sections });
  if (cache.size >= 100) { const oldest = cache.keys().next().value; if (oldest) cache.delete(oldest); }
  // Briefly cache errors to avoid flooding a restricted key; never serve expired quotes.
  cache.set(key, { expires: Date.now() + (sections.some(s => s.error) ? 10_000 : 300_000), response });
  res.json(response);
});

export default router;
