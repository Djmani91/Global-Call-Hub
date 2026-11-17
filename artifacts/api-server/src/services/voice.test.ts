import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, createHmac } from "node:crypto";
import express from "express";
import { clerkMiddleware } from "@clerk/express";
import twilio from "twilio";
import voiceRouter from "../routes/voice";
import {
  buildPreparedVoiceToken, canonicalWebhookUrl, incomingIdentity, ownedCallerId,
  validVoiceSignature, voiceIdentity, VOICE_TOKEN_TTL_SECONDS,
} from "./voice";

test("customer identity and number assignment cannot cross customer boundaries", () => {
  const assignment = { customerId: "user_alice", phoneNumber: "+12025550123", revokedAt: null };
  assert.match(voiceIdentity("user_alice"), /^linea_[0-9a-f]{64}$/);
  assert.notEqual(voiceIdentity("user_alice"), voiceIdentity("user_bob"));
  assert.throws(() => voiceIdentity(""));
  assert.equal(ownedCallerId("user_alice", assignment.phoneNumber, assignment), assignment.phoneNumber);
  assert.equal(ownedCallerId("user_bob", assignment.phoneNumber, assignment), null);
  assert.equal(ownedCallerId("user_alice", "+12025550999", assignment), null);
  assert.equal(ownedCallerId("user_alice", assignment.phoneNumber, { ...assignment, revokedAt: new Date() }), null);
  assert.equal(incomingIdentity(assignment.phoneNumber, assignment), voiceIdentity("user_alice"));
  assert.equal(incomingIdentity("+12025550999", assignment), null);
  assert.equal(incomingIdentity(assignment.phoneNumber, null), null);
});

test("offline token preparation uses a five-minute, customer-scoped, platform-push Voice grant", () => {
  const config = {
    accountSid: `AC${"1".repeat(32)}`, apiKeySid: `SK${"2".repeat(32)}`,
    apiKeySecret: "offline-fixture-only", applicationSid: `AP${"3".repeat(32)}`,
    pushCredentialSid: `CR${"4".repeat(32)}`,
  };
  const jwt = buildPreparedVoiceToken("user_alice", config);
  const [header, body, signature] = jwt.split(".");
  assert.equal(signature, createHmac("sha256", config.apiKeySecret).update(`${header}.${body}`).digest("base64url"));
  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  assert.equal(payload.exp - payload.iat, VOICE_TOKEN_TTL_SECONDS);
  assert.equal(payload.grants.identity, voiceIdentity("user_alice"));
  assert.equal(payload.grants.voice.outgoing.application_sid, config.applicationSid);
  assert.equal(payload.grants.voice.push_credential_sid, config.pushCredentialSid);
  assert.deepEqual(payload.grants.voice.incoming, { allow: true });
  assert.equal(payload.iss, config.apiKeySid);
  assert.equal(payload.sub, config.accountSid);
  assert.throws(() => buildPreparedVoiceToken("", config));
  assert.throws(() => buildPreparedVoiceToken("user_alice", { ...config, applicationSid: "" }));
});

test("canonical callback URLs cannot be replaced by hostile hosts or query strings", () => {
  assert.equal(canonicalWebhookUrl("https://voice.example", "/api/voice/webhooks/incoming"), "https://voice.example/api/voice/webhooks/incoming");
  for (const origin of [undefined, "http://voice.example", "https://user:pass@voice.example", "https://voice.example/base", "https://voice.example?x=1"]) {
    assert.equal(canonicalWebhookUrl(origin, "/api/voice/webhooks/incoming"), null);
  }
  assert.equal(canonicalWebhookUrl("https://voice.example", "/api/voice/webhooks/incoming?identity=bob"), null);
  assert.equal(validVoiceSignature("fixture", "bogus", "https://voice.example", {}), false);
});

// Exercise real Clerk signature verification using local RSA keys. No auth/network bypass
// is exported from production code, and no real accounts, secrets or calls are used.
test("HTTP routes reject anonymous/forged sessions and every billable path stays locked", async () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const now = Math.floor(Date.now() / 1000);
  const issuer = "https://linea-fixture.clerk.accounts.dev";
  const session = (customerId: string, expires = now + 120) => {
    const head = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "fixture", cat: "cl_B7d4PD111AAA" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({
      iss: issuer, sub: customerId, sid: "sess_fixture", iat: now, nbf: now - 10, exp: expires,
      azp: "https://linea.example", v: 2,
    })).toString("base64url");
    return `${head}.${body}.${sign("RSA-SHA256", Buffer.from(`${head}.${body}`), privateKey).toString("base64url")}`;
  };
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(clerkMiddleware({
    publishableKey: `pk_test_${Buffer.from("linea-fixture.clerk.accounts.dev$").toString("base64")}`,
    jwtKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
    authorizedParties: ["https://linea.example"],
  }));
  app.use("/api", voiceRouter);
  const server = app.listen(0);
  await new Promise<void>(resolve => server.once("listening", resolve));
  const addr = server.address();
  assert(addr && typeof addr === "object");
  const base = `http://127.0.0.1:${addr.port}`;
  const keys = ["TWILIO_AUTH_TOKEN", "TWILIO_ACCOUNT_SID", "VOICE_WEBHOOK_ORIGIN"] as const;
  const previous = keys.map(k => process.env[k]);
  try {
    const tokenRequest = (token?: string, body: object = { platform: "ios" }) => fetch(`${base}/api/voice/token`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    assert.equal((await tokenRequest()).status, 401);
    assert.equal((await tokenRequest("forged")).status, 401);
    assert.equal((await tokenRequest(session("user_alice", now - 60))).status, 401);
    for (const user of ["user_alice", "user_bob"]) {
      for (const platform of ["ios", "android"]) {
        const response = await tokenRequest(session(user), { platform });
        assert.equal(response.status, 503, response.headers.get("x-clerk-auth-reason") ?? "Valid fixture session must authenticate");
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(((await response.json()) as { token?: string }).token, undefined);
      }
    }
    for (const body of [
      { platform: "ios", identity: "user_bob" }, { platform: "ios", callerId: "+12025550999" },
      { platform: "web" }, {},
    ]) assert.equal((await tokenRequest(session("user_alice"), body)).status, 400);
    const readiness = await fetch(`${base}/api/voice/readiness`);
    assert.equal(((await readiness.json()) as { enabled: boolean }).enabled, false);

    process.env.TWILIO_AUTH_TOKEN = "offline-webhook-fixture";
    process.env.TWILIO_ACCOUNT_SID = `AC${"1".repeat(32)}`;
    process.env.VOICE_WEBHOOK_ORIGIN = "https://voice.example";
    const form = { AccountSid: process.env.TWILIO_ACCOUNT_SID, CallSid: `CA${"5".repeat(32)}`, From: "+12025550111", To: "+12025550123", FutureField: "signed too" };
    const callback = (direction: string, body: Record<string, string>, signature?: string, type = "application/x-www-form-urlencoded") =>
      fetch(`${base}/api/voice/webhooks/${direction}`, {
        method: "POST", headers: { "Content-Type": type, Host: "attacker.example", "X-Forwarded-Host": "attacker.example",
          ...(signature ? { "X-Twilio-Signature": signature } : {}) },
        body: new URLSearchParams(body).toString(),
      });
    for (const direction of ["incoming", "outgoing"]) {
      const url = `https://voice.example/api/voice/webhooks/${direction}`;
      const signature = twilio.getExpectedTwilioSignature(process.env.TWILIO_AUTH_TOKEN, url, form);
      assert.equal((await callback(direction, form)).status, 403);
      assert.equal((await callback(direction, form, "forged")).status, 403);
      assert.equal((await callback(direction, { ...form, To: "+12025550999" }, signature)).status, 403);
      assert.equal((await callback(direction, { ...form, FutureField: "changed" }, signature)).status, 403);
      const wrongAccount = { ...form, AccountSid: `AC${"9".repeat(32)}` };
      assert.equal((await callback(direction, wrongAccount, twilio.getExpectedTwilioSignature(process.env.TWILIO_AUTH_TOKEN, url, wrongAccount))).status, 403);
      const response = await callback(direction, form, signature);
      assert.equal(response.status, 200);
      const xml = await response.text();
      assert.match(xml, /<Reject/);
      assert.doesNotMatch(xml, /Dial|Redirect|Client|Number/);
      assert.equal((await callback(direction, form, signature, "text/plain")).status, 415);
      delete process.env.TWILIO_AUTH_TOKEN;
      assert.equal((await callback(direction, form, signature)).status, 503);
      process.env.TWILIO_AUTH_TOKEN = "offline-webhook-fixture";
    }
  } finally {
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
