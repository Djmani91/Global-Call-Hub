import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// No catalog/price table: these are immutable monetary facts, not product definitions.
export const creditPurchases = pgTable("credit_purchases", {
  key: text("key").primaryKey(),
  customerId: text("customer_id").notNull(),
  currency: text("currency").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  environment: text("environment").notNull(),
  refunded: integer("refunded").notNull().default(0),
});
export const creditLedger = pgTable("credit_ledger", {
  id: text("id").primaryKey(),
  purchaseKey: text("purchase_key").notNull().references(() => creditPurchases.key),
  customerId: text("customer_id").notNull(),
  currency: text("currency").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  environment: text("environment").notNull(),
  kind: text("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertCreditPurchaseSchema = createInsertSchema(creditPurchases);
export const insertCreditLedgerSchema = createInsertSchema(creditLedger);
export type CreditPurchase = typeof creditPurchases.$inferSelect;
export type CreditLedgerEntry = typeof creditLedger.$inferSelect;
