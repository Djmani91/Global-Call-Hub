import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const customerPhoneChallenges = pgTable("customer_phone_challenges", {
  id: text("id").primaryKey(),
  phoneNumber: text("phone_number").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customerProfiles = pgTable("customer_profiles", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  phoneNumber: text("phone_number").notNull().unique(),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }).notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customerAuthRateLimits = pgTable("customer_auth_rate_limits", {
  bucketKey: text("bucket_key").primaryKey(),
  count: integer("count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
