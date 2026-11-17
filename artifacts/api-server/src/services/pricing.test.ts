import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import pricingRouter from "../routes/twilio-pricing";
import { GetTwilioPricingResponse } from "@workspace/api-zod";
import { BILLING_CURRENCIES, customerAmount, exchangeRate, extractRates } from "./pricing";

test("3× markup and currency conversion round only at the end", () => {
  assert.equal(customerAmount("1", 1, 2), 3);
  assert.equal(customerAmount("1.15", 1, 2), 3.45);
  assert.equal(customerAmount("1.15", "0.8", 2), 2.76);
  assert.equal(customerAmount("0.0083", 1, 6), 0.0249);
  assert.equal(customerAmount("0.0085", "0.75767", 6), 0.019321);
  assert.equal(customerAmount("0.005", 1, 2), 0.02);
  assert.equal(customerAmount("0", 1, 6), 0);
  for (const invalid of [null, undefined, "", "-1", "abc", Infinity]) {
    assert.throws(() => customerAmount(invalid, 1, 2));
  }
  assert.throws(() => customerAmount("1", 0, 2));
  assert.equal(BILLING_CURRENCIES.US, "USD");
  assert.equal(BILLING_CURRENCIES.GB, "GBP");
  assert.equal(BILLING_CURRENCIES.PR, "USD");
});

const fixture = (kind: string, country: string) => ({
  iso_country: country, price_unit: "USD",
  ...(kind === "numbers" ? { phone_number_prices: [
    { number_type: "local", current_price: "1.15", base_price: "99" },
    { number_type: "toll free", current_price: "2.15" },
  ] } : kind === "voice" ? {
    inbound_call_prices: [{ number_type: "local", current_price: "0.0085" }],
    outbound_prefix_prices: [
      { friendly_name: "Standard", current_price: "0.014", prefixes: ["1"], origination_prefixes: [] },
      { friendly_name: "Special origin", current_price: "0.09", prefixes: ["1907"], origination_prefixes: ["44"] },
    ],
  } : {
    inbound_sms_prices: [{ number_type: "local", current_price: "0.0083" }],
    outbound_sms_prices: [{ mcc: "310", mnc: "123", carrier: "Example network",
      prices: [{ number_type: "local", current_price: "0.0083" }, { number_type: "tollfree", current_price: "0.01" }] }],
  }),
});

test("all direction, carrier and origin-specific variations are preserved", () => {
  const voice = extractRates("voice", fixture("voice", "US"));
  assert.equal(voice.length, 3);
  assert.equal(voice[0].direction, "incoming");
  assert.deepEqual(voice[2].prefixes, ["1907"]);
  assert.match(voice[2].label, /origin prefixes 44/);
  const sms = extractRates("sms", fixture("sms", "US"));
  assert.equal(sms.length, 3);
  assert.equal(sms[2].unit, "segment");
  assert.match(sms[2].label, /310 \/ MNC 123/);
  assert.throws(() => extractRates("numbers", { phone_number_prices: [{ current_price: null }] }));
});

test("pricing API handles conversion, cache isolation, partial permissions and missing FX without fake rates", async () => {
  const app = express();
  app.use(pricingRouter);
  const server = app.listen(0);
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const realFetch = globalThis.fetch;
  const previousSid = process.env.TWILIO_PRICING_API_KEY_SID;
  const previousSecret = process.env.TWILIO_PRICING_API_KEY_SECRET;
  // Synthetic values only, never real credentials in test output.
  process.env.TWILIO_PRICING_API_KEY_SID = "test-pricing-key";
  process.env.TWILIO_PRICING_API_KEY_SECRET = "test-pricing-secret";
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push(url);
    if (url.includes("frankfurter")) {
      if (url.endsWith("/MXN")) throw new Error("offline");
      return Response.json({ base: "USD", quote: "GBP", rate: 0.8, date: new Date().toISOString().slice(0, 10) });
    }
    assert.equal(new Headers(init?.headers).get("Authorization"),
      `Basic ${Buffer.from("test-pricing-key:test-pricing-secret").toString("base64")}`);
    const country = url.split("/").at(-1)!;
    const kind = url.includes("PhoneNumbers") ? "numbers" : url.includes("Voice") ? "voice" : "sms";
    if (country === "FR" && kind === "voice") return Response.json({ code: 8011 }, { status: 401 });
    if (country === "FR" && kind === "sms") return Response.json({ code: 8021 }, { status: 401 });
    return Response.json(fixture(kind, country));
  };
  try {
    const get = (country: string, billing: string) => realFetch(`${base}/twilio/pricing?countryCode=${country}&billingCountry=${billing}`);
    const usd = GetTwilioPricingResponse.parse(await (await get("US", "US")).json());
    const gbp = GetTwilioPricingResponse.parse(await (await get("US", "GB")).json());
    assert.equal(usd.currency, "USD");
    assert.equal(gbp.currency, "GBP");
    assert.equal(usd.multiplier, 3);
    assert.equal(usd.sections[0].rates[0].amount, 3.45);
    assert.equal(gbp.sections[0].rates[0].amount, 2.76);
    assert.equal(gbp.sections[1].rates[0].amount, 0.0204);
    assert.equal(gbp.sections[2].rates[0].amount, 0.01992);
    assert(!JSON.stringify(gbp).includes("base_price"));
    assert(requests.some(url => url.includes("/v1/PhoneNumbers/Countries/")));
    assert(requests.some(url => url.includes("/v2/Voice/Countries/")));
    assert(requests.some(url => url.includes("/v1/Messaging/Countries/")));
    const beforeCache = requests.length;
    await get("US", "US");
    assert.equal(requests.length, beforeCache);
    const partial = GetTwilioPricingResponse.parse(await (await get("FR", "US")).json());
    assert.equal(partial.sections[0].rates.length, 2);
    for (const section of partial.sections.slice(1)) {
      assert(section.error);
      assert.match(section.error, section.kind === "voice" ? /access is unavailable.*8011/ : /permission is missing/);
      assert.deepEqual(section.rates, []);
    }
    const failedFx = GetTwilioPricingResponse.parse(await (await get("CA", "MX")).json());
    for (const section of failedFx.sections) {
      assert(section.error);
      assert.match(section.error, /Exchange rate unavailable/);
      assert.deepEqual(section.rates, []);
      assert.equal(section.exchangeRate, null);
    }
    assert.equal((await get("Z", "US")).status, 400);
    assert.equal((await get("US", "ZZ")).status, 400);
    assert.equal((await realFetch(`${base}/twilio/pricing?countryCode=US`)).status, 400);
    assert.deepEqual(await exchangeRate("USD", "USD"), { rate: 1, date: null });
    delete process.env.TWILIO_PRICING_API_KEY_SECRET;
    const unconfigured = GetTwilioPricingResponse.parse(await (await get("AU", "US")).json());
    for (const section of unconfigured.sections) {
      assert.match(section.error ?? "", /pricing credentials are not configured/);
      assert.deepEqual(section.rates, []);
    }
  } finally {
    globalThis.fetch = realFetch;
    if (previousSid === undefined) delete process.env.TWILIO_PRICING_API_KEY_SID; else process.env.TWILIO_PRICING_API_KEY_SID = previousSid;
    if (previousSecret === undefined) delete process.env.TWILIO_PRICING_API_KEY_SECRET; else process.env.TWILIO_PRICING_API_KEY_SECRET = previousSecret;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
