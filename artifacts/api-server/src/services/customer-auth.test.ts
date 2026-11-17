import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { clerkMiddleware } from "@clerk/express";
import customerAuthRouter from "../routes/customer-auth";
import {
  checkTwilioVerification,
  digestChallenge,
  digestRateLimitKey,
  isConfiguredAdmin,
  isValidE164,
  startTwilioVerification,
  twilioVerifyConfig,
  verifiedPrimaryEmail,
  VerifyProviderError,
} from "./customer-auth";

const config = {
  apiKeySid: `SK${"1".repeat(32)}`,
  apiKeySecret: "local-fixture-only",
  serviceSid: `VA${"2".repeat(32)}`,
};

test("Twilio Verify configuration rejects missing or malformed credentials", () => {
  assert.deepEqual(twilioVerifyConfig({
    TWILIO_VERIFY_API_KEY_SID: config.apiKeySid,
    TWILIO_VERIFY_API_KEY_SECRET: config.apiKeySecret,
    TWILIO_VERIFY_SERVICE_SID: config.serviceSid,
  }), config);
  assert.equal(twilioVerifyConfig({}), null);
  assert.equal(twilioVerifyConfig({
    TWILIO_VERIFY_API_KEY_SID: "ACnot-a-verify-key",
    TWILIO_VERIFY_API_KEY_SECRET: config.apiKeySecret,
    TWILIO_VERIFY_SERVICE_SID: config.serviceSid,
  }), null);
});

test("phone validation accepts only international E.164 format", () => {
  assert.equal(isValidE164("+447700900123"), true);
  for (const phone of ["07700900123", "+0123456789", "+1234567", "+1234567890123456", "+44 7700 900123"]) {
    assert.equal(isValidE164(phone), false);
  }
});

test("challenge and rate-limit digests are deterministic and keyed", () => {
  assert.equal(digestChallenge("proof"), digestChallenge("proof"));
  assert.notEqual(digestChallenge("proof"), "proof");
  assert.notEqual(digestRateLimitKey("source", "one"), digestRateLimitKey("source", "two"));
});

test("admin access requires a matching verified primary email", () => {
  const user = {
    primaryEmailAddressId: "email_1",
    emailAddresses: [{
      id: "email_1",
      emailAddress: "Owner@Example.com",
      verification: { status: "verified" },
    }],
  };
  const email = verifiedPrimaryEmail(user);
  assert.equal(email, "owner@example.com");
  assert.equal(isConfiguredAdmin(email, { LINEA_ADMIN_EMAIL: "OWNER@example.com" }), true);
  assert.equal(isConfiguredAdmin(email, { LINEA_ADMIN_EMAIL: "other@example.com" }), false);
  assert.equal(isConfiguredAdmin(null, { LINEA_ADMIN_EMAIL: "owner@example.com" }), false);
  const ownerHash = digestChallenge("owner@example.com");
  assert.equal(isConfiguredAdmin(email, { LINEA_ADMIN_EMAIL_SHA256: ownerHash }), true);
  assert.equal(isConfiguredAdmin("other@example.com", { LINEA_ADMIN_EMAIL_SHA256: ownerHash }), false);
  assert.equal(verifiedPrimaryEmail({
    ...user,
    emailAddresses: [{ ...user.emailAddresses[0], verification: { status: "unverified" } }],
  }), null);
});

test("Twilio Verify uses form-encoded server requests and reports only safe failures", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify({ status: "pending" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  await startTwilioVerification(config, "+447700900123", fetcher);
  const approved = await checkTwilioVerification(config, "+447700900123", "123456", async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify({ status: "approved" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  assert.equal(approved, true);
  assert.match(calls[0].url, /\/Verifications$/);
  assert.match(calls[1].url, /\/VerificationCheck$/);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers && (calls[0].init.headers as Record<string, string>)["Content-Type"], "application/x-www-form-urlencoded");
  assert.equal(new URLSearchParams(String(calls[0].init.body)).get("To"), "+447700900123");
  assert.equal(new URLSearchParams(String(calls[0].init.body)).get("Channel"), "sms");
  assert.equal(new URLSearchParams(String(calls[1].init.body)).get("Code"), "123456");
  assert.equal(await checkTwilioVerification(config, "+447700900123", "000000", async () =>
    new Response(JSON.stringify({ status: "pending" }), { status: 200 })), false);
  await assert.rejects(
    () => startTwilioVerification(config, "+447700900123", async () =>
      new Response(JSON.stringify({ code: 60200 }), { status: 400 })),
    (error: unknown) => error instanceof VerifyProviderError && error.status === 400 && error.providerCode === 60200,
  );
});

test("HTTP authentication routes reject anonymous access and malformed requests without sending SMS", async () => {
  const app = express();
  app.use(express.json());
  app.use(clerkMiddleware({
    publishableKey: `pk_test_${Buffer.from("linea-fixture.clerk.accounts.dev$").toString("base64")}`,
  }));
  app.use("/api", customerAuthRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api`;
  try {
    for (const path of ["/auth/me", "/admin/customers"]) {
      for (const token of [undefined, "forged"]) {
        const response = await fetch(`${base}${path}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        assert.equal(response.status, 401);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal((await response.text()).includes("customers"), false);
      }
    }
    const complete = await fetch(`${base}/auth/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationToken: "untrusted-proof" }),
    });
    assert.equal(complete.status, 401);
    for (const phoneNumber of ["07700900123", "+0123456789", "+44 7700 900123"]) {
      const response = await fetch(`${base}/auth/phone/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      assert.equal(response.status, 400);
    }
    const invalidCheck = await fetch(`${base}/auth/phone/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId: "", code: "not-a-code" }),
    });
    assert.equal(invalidCheck.status, 400);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
