import { and, eq, isNull } from "drizzle-orm";
import { db, voiceNumberAssignments } from "@workspace/db";
import { incomingIdentity, ownedCallerId } from "./voice";

// Deliberately no write endpoint. Provider inventory is not proof of customer ownership.
export async function resolveOwnedCallerId(customerId: string, phoneNumber: string): Promise<string | null> {
  const [assignment] = await db.select().from(voiceNumberAssignments).where(and(
    eq(voiceNumberAssignments.customerId, customerId),
    eq(voiceNumberAssignments.phoneNumber, phoneNumber),
    isNull(voiceNumberAssignments.revokedAt),
  )).limit(1);
  return ownedCallerId(customerId, phoneNumber, assignment ?? null);
}

export async function resolveIncomingIdentity(phoneNumber: string): Promise<string | null> {
  const [assignment] = await db.select().from(voiceNumberAssignments).where(and(
    eq(voiceNumberAssignments.phoneNumber, phoneNumber),
    isNull(voiceNumberAssignments.revokedAt),
  )).limit(1);
  return incomingIdentity(phoneNumber, assignment ?? null);
}
