import { test, after } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, randomUUID } from "node:crypto";
import express from "express";
import { clerkMiddleware } from "@clerk/express";
import { GetCreditWalletResponse } from "@workspace/api-zod";
import { db, pool, creditLedger, creditPurchases } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import router from "../routes/credits";
import { applyCreditFact, billingReadiness } from "./credits";
import { creditTransition, purchaseFact, validWebhookAuthorization, type CreditFact, type VerifiedPurchase } from "./credit-policy";

after(async () => { await pool.end(); });
const alice = "user_creditfixturealice", bob = "user_creditfixturebob";
const config = { projectId: "fixture", testAppId: "apptest", androidAppId: "appplay", productionEnabled: false };
const product = { app_id: "apptest", store_identifier: "pack", type: "consumable" };
const packs = { pack: { currency: "GBP", minor: 500 } };
const receipt: VerifiedPurchase = {
  customer_id: alice, original_customer_id: alice, product_id: "prod",
  store_purchase_identifier: "fixture-order", store: "test_store", environment: "sandbox",
  status: "owned", quantity: 1,
};
const fact = () => purchaseFact(alice, receipt, product, packs, config);

test("only canonical customer-owned settled consumables can create credit facts", () => {
  assert.equal(fact().amountMinor, 500);
  for (const patch of [
    { customer_id: bob }, { original_customer_id: bob }, { status: "pending" },
    { status: "cancelled" }, { status: "failed" }, { quantity: 0 }, { quantity: 2 },
    { store: "app_store" }, { environment: "production" }, { environment: "PRODUCTION" },
    { store_purchase_identifier: "" },
  ]) assert.throws(() => purchaseFact(alice, { ...receipt, ...patch }, product, packs, config));
  assert.throws(() => purchaseFact(bob, receipt, product, packs, config));
  assert.throws(() => purchaseFact(alice, receipt, { ...product, app_id: "other" }, packs, config));
  assert.throws(() => purchaseFact(alice, receipt, { ...product, type: "subscription" }, packs, config));
  for (const minor of [0, -500, 1.5, NaN, Infinity, 1e9]) {
    assert.throws(() => purchaseFact(alice, receipt, product, { pack: { currency: "GBP", minor } }, config));
  }
  assert.throws(() => purchaseFact(alice, receipt, product, { pack: { currency: "USD", minor: 500 } }, config));
});

test("production requires verified Play Store, configured app and explicit enablement", () => {
  const playReceipt = { ...receipt, store: "play_store", environment: "production" };
  const playProduct = { ...product, app_id: "appplay" };
  assert.throws(() => purchaseFact(alice, playReceipt, playProduct, packs, config));
  assert.equal(purchaseFact(alice, playReceipt, playProduct, packs, { ...config, productionEnabled: true }).environment, "production");
  assert.equal(purchaseFact(alice, { ...playReceipt, status: "refunded" }, playProduct, packs, config).refunded, 1);
  assert.notEqual(fact().key, purchaseFact(alice, { ...playReceipt, environment: "sandbox" }, playProduct, packs, config).key);
});

test("duplicates, out-of-order refunds, owner changes and price edits cannot over-credit", () => {
  const first = fact();
  assert.equal(creditTransition(null, first).delta, 500);
  assert.equal(creditTransition(first, first).delta, 0);
  assert.equal(creditTransition(first, { ...first, amountMinor: 1500 }).delta, 0);
  assert.equal(creditTransition(first, { ...first, amountMinor: 1500, refunded: 1 }).delta, -500);
  assert.equal(creditTransition(null, { ...first, refunded: 1 }).delta, 0);
  assert.equal(creditTransition({ ...first, refunded: 1 }, first).delta, 0);
  for (const patch of [{ customerId: bob }, { currency: "USD" }, { environment: "production" as const }]) {
    assert.throws(() => creditTransition(first, { ...first, ...patch }));
  }
});

test("authenticated webhook authorization is exact, constant-time and fails closed", () => {
  const secret = "fixture-webhook-authorization-".repeat(2);
  assert.equal(validWebhookAuthorization(secret, secret), true);
  for (const supplied of [undefined, "", "forged", `${secret} `, `Bearer ${secret}`]) {
    assert.equal(validWebhookAuthorization(supplied, secret), false);
  }
  assert.equal(validWebhookAuthorization(secret, undefined), false);
  assert.equal(validWebhookAuthorization("short", "short"), false);
  const previous = process.env.LINEA_PLAY_BILLING_ENABLED;
  delete process.env.LINEA_PLAY_BILLING_ENABLED;
  assert.equal(billingReadiness().productionEnabled, false);
  if (previous !== undefined) process.env.LINEA_PLAY_BILLING_ENABLED = previous;
});

test("durable ledger applies purchase/refund once, separates test funds and rolls back atomically", async () => {
  const sentinel = new Error("ROLLBACK_TEST_FIXTURES");
  const prefix = `fixture-${randomUUID()}`;
  await assert.rejects(db.transaction(async tx => {
    const testFact = { ...fact(), key: `${prefix}:sandbox` };
    const prodFact: CreditFact = { ...fact(), key: `${prefix}:production`, environment: "production", amountMinor: 1000 };
    for (let i = 0; i < 3; i++) await applyCreditFact(tx, testFact);
    for (let i = 0; i < 3; i++) await applyCreditFact(tx, prodFact);
    await applyCreditFact(tx, { ...testFact, refunded: 1 });
    await applyCreditFact(tx, { ...testFact, refunded: 1 });
    await applyCreditFact(tx, testFact); // late success notification
    const ledger = await tx.select().from(creditLedger).where(eq(creditLedger.customerId, alice));
    const owned = ledger.filter(e => e.purchaseKey.startsWith(prefix));
    assert.equal(owned.length, 3);
    assert.equal(owned.filter(e => e.environment === "production").reduce((n, e) => n + e.amountMinor, 0), 1000);
    assert.equal(owned.filter(e => e.environment === "sandbox").reduce((n, e) => n + e.amountMinor, 0), 0);
    assert(owned.every(e => e.customerId === alice && e.currency === "GBP"));
    // A second reader in the same durable transaction sees exactly the saved facts.
    const [saved] = await tx.select().from(creditPurchases).where(eq(creditPurchases.key, testFact.key));
    assert.equal(saved.refunded, 1);
    // Refund before success never manufactures a negative balance or a late credit.
    const early = { ...testFact, key: `${prefix}:early`, refunded: 1 };
    await applyCreditFact(tx, early);
    await applyCreditFact(tx, { ...early, refunded: 0 });
    assert.equal((await tx.select().from(creditLedger).where(eq(creditLedger.purchaseKey, early.key))).length, 0);
    throw sentinel;
  }), e => e === sentinel);
  const leaked = await db.select().from(creditPurchases).where(sql`${creditPurchases.key} like ${`${prefix}%`}`);
  assert.equal(leaked.length, 0, "No test credits may survive the test transaction");
});

test("HTTP routes reject forged sessions, client amounts/identities and forged webhooks", async () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const now = Math.floor(Date.now() / 1000);
  const session = (sub: string) => {
    const head = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "fixture", cat: "cl_B7d4PD111AAA" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ iss: "https://linea-fixture.clerk.accounts.dev",
      sub, sid: "sess_fixture", iat: now, nbf: now - 10, exp: now + 120, azp: "https://linea.example", v: 2 })).toString("base64url");
    return `${head}.${body}.${sign("RSA-SHA256", Buffer.from(`${head}.${body}`), privateKey).toString("base64url")}`;
  };
  const app = express();
  app.use(express.json());
  app.use(clerkMiddleware({
    publishableKey: `pk_test_${Buffer.from("linea-fixture.clerk.accounts.dev$").toString("base64")}`,
    jwtKey: publicKey.export({ type: "spki", format: "pem" }).toString(), authorizedParties: ["https://linea.example"],
  }));
  app.use("/api", router);
  const server = app.listen(0);
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api/billing`;
  const key = "REVENUECAT_WEBHOOK_AUTHORIZATION";
  const previous = process.env[key];
  try {
    for (const auth of [undefined, "forged"]) {
      for (const route of ["wallet", "reconcile"]) {
        const response = await fetch(`${base}/${route}`, { method: route === "wallet" ? "GET" : "POST",
          headers: auth ? { Authorization: `Bearer ${auth}` } : {} });
        assert.equal(response.status, 401);
        assert.equal(response.headers.get("cache-control"), "no-store");
      }
    }
    for (const sub of [alice, bob]) {
      const response = await fetch(`${base}/wallet`, { headers: { Authorization: `Bearer ${session(sub)}` } });
      assert.equal(response.status, 200);
      const wallet = GetCreditWalletResponse.parse(await response.json());
      assert.equal(wallet.customerId, sub);
      assert.equal(wallet.currency, "GBP");
      assert.equal(wallet.balanceMinor, 0);
      assert.deepEqual(wallet.transactions, []);
      for (const body of [{ amount: 500 }, { customerId: bob }, { transactionId: "forged" }, { balance: 10000 }]) {
        assert.equal((await fetch(`${base}/reconcile`, { method: "POST",
          headers: { Authorization: `Bearer ${session(sub)}`, "Content-Type": "application/json" }, body: JSON.stringify(body) })).status, 400);
      }
    }
    delete process.env[key];
    assert.equal((await fetch(`${base}/webhook`, { method: "POST" })).status, 503);
    process.env[key] = "fixture-long-random-header-not-real-authorization";
    assert.equal((await fetch(`${base}/webhook`, { method: "POST", headers: { Authorization: "forged" } })).status, 403);
    const callback = (body: object) => fetch(`${base}/webhook`, { method: "POST",
      headers: { Authorization: process.env[key]!, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    assert.equal((await callback({ event: { id: "test", type: "TEST" } })).status, 204);
    assert.equal((await callback({ event: { id: "test", type: "NON_RENEWING_PURCHASE", app_user_id: bob, app_id: "wrong" } })).status, 400);
  } finally {
    if (previous === undefined) delete process.env[key]; else process.env[key] = previous;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
