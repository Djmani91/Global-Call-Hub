import { timingSafeEqual } from "node:crypto";

export function validWebhookAuthorization(actual: string | undefined, expected: string | undefined) {
  if (!actual || !expected || expected.length < 32) return false;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type VerifiedPurchase = {
  customer_id: string; original_customer_id: string; product_id: string;
  store_purchase_identifier: string; store: string; environment: string;
  status: string; quantity: number;
};
export type CreditFact = {
  key: string; customerId: string; currency: string; amountMinor: number;
  environment: "sandbox" | "production"; refunded: number;
};
export function purchaseFact(
  customerId: string, purchase: VerifiedPurchase,
  product: { app_id: string; store_identifier: string; type: string },
  packs: Record<string, { currency: string; minor: number }>,
  config: { projectId: string; testAppId?: string; androidAppId?: string; productionEnabled: boolean },
): CreditFact {
  if (!customerId.startsWith("user_") || purchase.customer_id !== customerId ||
      purchase.original_customer_id !== customerId) throw new Error("Purchase identity mismatch.");
  if (!purchase.store_purchase_identifier || purchase.store_purchase_identifier.length > 512 ||
      purchase.quantity !== 1 || !["owned", "refunded"].includes(purchase.status)) {
    throw new Error("Purchase is not a settled single credit pack.");
  }
  const sandbox = purchase.environment === "sandbox";
  const production = purchase.environment === "production";
  const test = purchase.store === "test_store" && sandbox && product.app_id === config.testAppId;
  const play = purchase.store === "play_store" && product.app_id === config.androidAppId &&
    (sandbox || (production && (config.productionEnabled || purchase.status === "refunded")));
  if ((!test && !play) || product.type !== "consumable") throw new Error("Store or environment is not enabled.");
  const pack = packs[product.store_identifier];
  if (!pack || pack.currency !== "GBP" || !Number.isSafeInteger(pack.minor) ||
      pack.minor <= 0 || pack.minor > 100_000) throw new Error("Credit metadata is missing or invalid.");
  return {
    key: JSON.stringify([config.projectId, purchase.store, purchase.environment, purchase.store_purchase_identifier]),
    customerId, currency: "GBP", amountMinor: pack.minor,
    environment: sandbox ? "sandbox" : "production", refunded: purchase.status === "refunded" ? 1 : 0,
  };
}

// Terminal refund: a late/replayed owned snapshot must never re-credit a reversed purchase.
export function creditTransition(existing: CreditFact | null, next: CreditFact) {
  if (!existing) return { insert: true, refund: !!next.refunded, delta: next.refunded ? 0 : next.amountMinor };
  if (existing.customerId !== next.customerId || existing.currency !== next.currency ||
      existing.environment !== next.environment) throw new Error("Purchase already belongs to another wallet.");
  return { insert: false, refund: !!existing.refunded || !!next.refunded,
    delta: !existing.refunded && next.refunded ? -existing.amountMinor : 0 };
}
