import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod/v4";

// Operator-provisioned only, after verifying provider ownership and customer entitlement.
// No public API can assign or reassign numbers. A released number must be revoked first.
export const voiceNumberAssignments = pgTable("voice_number_assignments", {
  phoneNumber: text("phone_number").primaryKey(),
  customerId: text("customer_id").notNull(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});
export const insertVoiceNumberAssignmentSchema = createInsertSchema(voiceNumberAssignments);
export type VoiceNumberAssignment = typeof voiceNumberAssignments.$inferSelect;
export type InsertVoiceNumberAssignment = z.infer<typeof insertVoiceNumberAssignmentSchema>;
