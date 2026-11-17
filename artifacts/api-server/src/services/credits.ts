import { ReplitConnectors } from "@replit/connectors-sdk";
import { db, creditLedger, creditPurchases } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { GetCreditWalletResponse } from "@workspace/api-zod";
import { creditTransition, purchaseFact, type VerifiedPurchase, type CreditFact } from "./credit-policy";

const connectors = new ReplitConnectors();
export function billingReadiness() {
  const testEnabled = !!(process.env.REVENUECAT_PROJECT_ID && process.env.REVENUECAT_TEST_STORE_APP_ID &&
    process.env.REVENUECAT_CREDIT_OFFERING_ID);
  const productionEnabled = testEnabled && process.env.LINEA_PLAY_BILLING_ENABLED === "true" &&
    !!process.env.REVENUECAT_GOOGLE_PLAY_STORE_APP_ID && !!process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY &&
    (process.env.REVENUECAT_WEBHOOK_AUTHORIZATION?.length ?? 0) >= 32;
  return { productionEnabled, testEnabled, currency: "GBP" as const,
    message: productionEnabled ? "Google Play checkout is available on a configured installed Android app."
      : "Google Play setup is not complete. Test purchases are separate and cannot pay for calls, messages or numbers." };
}

async function rc<T>(path: string): Promise<T> {
  // Paths are constructed server-side only. No event-supplied URLs or redirects.
  const response = await connectors.proxy("revenuecat", path, { method: "GET", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("RevenueCat verification unavailable.");
  return response.json() as Promise<T>;
}
type Page<T> = { items: T[]; next_page?: string | null };
type Product = { app_id: string; store_identifier: string; type: string };
type Offering = { metadata?: { wallet_currency?: string; credit_packs?: Record<string, { currency: string; minor: number }> } };
type CreditTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// The only ledger writer. Called inside a transaction, after provider verification.
export async function applyCreditFact(tx: CreditTx, fact: CreditFact) {
  const [stored] = await tx.select().from(creditPurchases).where(eq(creditPurchases.key, fact.key)).for("update");
  const change = creditTransition(stored as CreditFact | undefined ?? null, fact);
  if (change.insert) await tx.insert(creditPurchases).values(fact);
  if (change.refund && stored) await tx.update(creditPurchases).set({ refunded: 1 }).where(eq(creditPurchases.key, fact.key));
  if (change.delta) await tx.insert(creditLedger).values({
    id: `${fact.key}:${change.delta > 0 ? "purchase" : "refund"}`,
    purchaseKey: fact.key, customerId: fact.customerId, currency: "GBP", amountMinor: change.delta,
    environment: fact.environment, kind: change.delta > 0 ? "purchase" : "refund",
  });
}

export async function readWallet(customerId: string) {
  const totals = await db.select({
    environment: creditLedger.environment,
    total: sql<string>`coalesce(sum(${creditLedger.amountMinor}), 0)`,
  }).from(creditLedger).where(eq(creditLedger.customerId, customerId)).groupBy(creditLedger.environment);
  const entries = await db.select().from(creditLedger).where(eq(creditLedger.customerId, customerId))
    .orderBy(desc(creditLedger.createdAt), desc(creditLedger.id)).limit(100);
  return GetCreditWalletResponse.parse({
    customerId, currency: "GBP",
    balanceMinor: Number(totals.find(t => t.environment === "production")?.total ?? 0),
    testBalanceMinor: Number(totals.find(t => t.environment === "sandbox")?.total ?? 0),
    transactions: entries.map(e => ({ id: e.id, amountMinor: e.amountMinor,
      environment: e.environment, kind: e.kind, createdAt: e.createdAt.toISOString() })),
  });
}

export async function reconcileWallet(customerId: string) {
  if (!/^user_[a-zA-Z0-9]+$/.test(customerId)) throw new Error("A canonical customer is required.");
  const ready = billingReadiness();
  if (!ready.testEnabled) throw new Error("RevenueCat setup incomplete.");
  const projectId = process.env.REVENUECAT_PROJECT_ID!;
  const base = `/v2/projects/${encodeURIComponent(projectId)}`;
  await db.transaction(async tx => {
    // Serialize concurrent refresh/webhook/purchase completion for this customer.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`credit:${customerId}`}, 0))`);
    const offering = await rc<Offering>(`${base}/offerings/${encodeURIComponent(process.env.REVENUECAT_CREDIT_OFFERING_ID!)}`);
    if (offering.metadata?.wallet_currency !== "GBP" || !offering.metadata.credit_packs) {
      throw new Error("Wallet metadata is not configured.");
    }
    const products = new Map<string, Product>();
    const deadline = Date.now() + 30_000;
    let after: string | undefined;
    for (let pageIndex = 0; ; pageIndex++) {
      if (pageIndex >= 100 || Date.now() > deadline) throw new Error("Reconciliation exceeds safety limit.");
      const page = await rc<Page<VerifiedPurchase & { id: string }>>(
        `${base}/customers/${encodeURIComponent(customerId)}/purchases?limit=100${after ? `&starting_after=${encodeURIComponent(after)}` : ""}`);
      if (!Array.isArray(page.items)) throw new Error("Invalid purchase response.");
      for (const purchase of page.items) {
        // Unrelated apps/products are ignored, never treated as wallet purchases.
        if (Date.now() > deadline) throw new Error("Verification timed out.");
        let product = products.get(purchase.product_id);
        if (!product) {
          product = await rc<Product>(`${base}/products/${encodeURIComponent(purchase.product_id)}`);
          products.set(purchase.product_id, product);
        }
        const key = JSON.stringify([projectId, purchase.store, purchase.environment, purchase.store_purchase_identifier]);
        const [stored] = await tx.select().from(creditPurchases).where(eq(creditPurchases.key, key)).for("update");
        if (!stored && !offering.metadata.credit_packs[product.store_identifier]) continue;
        // Existing monetary facts never change when product metadata changes.
        const packs = stored ? { [product.store_identifier]: { currency: stored.currency, minor: stored.amountMinor } }
          : offering.metadata.credit_packs;
        const fact = purchaseFact(customerId, purchase, product, packs, {
          // Disabling NEW checkout must not stop reversals of previously credited purchases.
          projectId, productionEnabled: ready.productionEnabled || !!stored,
          testAppId: process.env.REVENUECAT_TEST_STORE_APP_ID, androidAppId: process.env.REVENUECAT_GOOGLE_PLAY_STORE_APP_ID,
        });
        await applyCreditFact(tx, fact);
      }
      if (!page.next_page) break;
      const last = page.items.at(-1)?.id;
      if (!last || last === after) throw new Error("Invalid provider pagination.");
      after = last;
    }
  });
  return readWallet(customerId);
}
