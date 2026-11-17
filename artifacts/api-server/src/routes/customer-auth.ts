import { randomBytes } from "node:crypto";
import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { and, desc, eq, gt, lt, sql } from "drizzle-orm";
import {
  CheckCustomerPhoneVerificationBody,
  CheckCustomerPhoneVerificationResponse,
  CompleteCustomerRegistrationBody,
  CompleteCustomerRegistrationResponse,
  GetAdminCustomersResponse,
  GetCustomerAuthReadinessResponse,
  GetCustomerAuthMeResponse,
  StartCustomerPhoneVerificationBody,
  StartCustomerPhoneVerificationResponse,
} from "@workspace/api-zod";
import {
  customerAuthRateLimits,
  customerPhoneChallenges,
  customerProfiles,
  db,
} from "@workspace/db";
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
} from "../services/customer-auth";

const router: IRouter = Router();
const CHALLENGE_TTL_MS = 30 * 60_000;
const MAX_CODE_ATTEMPTS = 5;

const requireCustomer: RequestHandler = (req, res, next) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Sign in to your Linea account first." });
    return;
  }
  next();
};

function noStore(_req: unknown, res: { set: (name: string, value: string) => unknown }, next: () => void) {
  res.set("Cache-Control", "no-store");
  next();
}

async function incrementRateLimit(
  scope: string,
  source: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const keyHash = digestRateLimitKey(source, secret);
  const bucketKey = `${scope}:${keyHash}:${bucket}`;
  const expiresAt = new Date((bucket + 1) * windowMs);
  const [row] = await db
    .insert(customerAuthRateLimits)
    .values({ bucketKey, count: 1, expiresAt })
    .onConflictDoUpdate({
      target: customerAuthRateLimits.bucketKey,
      set: {
        count: sql`${customerAuthRateLimits.count} + 1`,
        expiresAt,
      },
    })
    .returning({ count: customerAuthRateLimits.count });
  return Boolean(row && row.count <= max);
}

function cleanProviderError(req: { log: { warn: (fields: object, message: string) => void } }, error: unknown) {
  if (error instanceof VerifyProviderError) {
    req.log.warn({ status: error.status, providerCode: error.providerCode }, "Twilio Verify request failed");
  } else {
    req.log.warn({ errorName: error instanceof Error ? error.name : "unknown" }, "Customer authentication request failed");
  }
}

router.use("/auth", noStore);
router.use("/admin", noStore);

router.get("/auth/readiness", (_req, res) => {
  const phoneVerificationEnabled = Boolean(twilioVerifyConfig());
  res.json(GetCustomerAuthReadinessResponse.parse({
    phoneVerificationEnabled,
    message: phoneVerificationEnabled
      ? "Phone verification is ready. A real SMS is sent only when a customer requests one."
      : "Twilio Verify credentials are missing or invalid. The API key SID should start with SK and the Verify Service SID with VA.",
  }));
});

router.post("/auth/phone/start", async (req, res): Promise<void> => {
  const parsed = StartCustomerPhoneVerificationBody.safeParse(req.body);
  if (!parsed.success || !isValidE164(parsed.data?.phoneNumber ?? "")) {
    res.status(400).json({ error: "Enter a valid international phone number." });
    return;
  }
  const config = twilioVerifyConfig();
  if (!config) {
    res.status(503).json({ error: "Phone verification is not configured yet." });
    return;
  }
  if (!process.env.SESSION_SECRET) {
    res.status(503).json({ error: "Phone verification is not safely available yet." });
    return;
  }

  const phoneNumber = parsed.data.phoneNumber;
  const ip = req.ip || "unknown";
  try {
    await db.delete(customerPhoneChallenges).where(lt(customerPhoneChallenges.expiresAt, new Date()));
    await db.delete(customerAuthRateLimits).where(lt(customerAuthRateLimits.expiresAt, new Date()));
    const [phoneHourlyAllowed, phoneDailyAllowed, sourceAllowed] = await Promise.all([
      incrementRateLimit("phone-send-hour", phoneNumber, 3, 60 * 60_000),
      incrementRateLimit("phone-send-day", phoneNumber, 8, 24 * 60 * 60_000),
      incrementRateLimit("source-send-hour", ip, 60, 60 * 60_000),
    ]);
    if (!phoneHourlyAllowed || !phoneDailyAllowed || !sourceAllowed) {
      res.status(429).json({ error: "Too many code requests. Please wait before trying again." });
      return;
    }
    const currentUserId = getAuth(req).userId;
    if (currentUserId && !await incrementRateLimit("account-send-hour", currentUserId, 8, 60 * 60_000)) {
      res.status(429).json({ error: "Too many code requests. Please wait before trying again." });
      return;
    }

    const challengeId = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
    await db.insert(customerPhoneChallenges).values({
      id: digestChallenge(challengeId),
      phoneNumber,
      status: "pending",
      attempts: 0,
      expiresAt,
    });
    try {
      await startTwilioVerification(config, phoneNumber);
    } catch (error) {
      await db.delete(customerPhoneChallenges).where(eq(customerPhoneChallenges.id, digestChallenge(challengeId)));
      cleanProviderError(req, error);
      res.status(503).json({
        error: "Twilio could not send this code. On a trial account, verify the recipient number in Twilio first.",
      });
      return;
    }
    res.json(StartCustomerPhoneVerificationResponse.parse({ challengeId, expiresAt: expiresAt.toISOString() }));
  } catch (error) {
    cleanProviderError(req, error);
    res.status(503).json({ error: "Phone verification could not start. Please retry shortly." });
  }
});

router.post("/auth/phone/check", async (req, res): Promise<void> => {
  const parsed = CheckCustomerPhoneVerificationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter the verification code from the SMS." });
    return;
  }
  const config = twilioVerifyConfig();
  if (!config) {
    res.status(503).json({ error: "Phone verification is not configured yet." });
    return;
  }
  if (!process.env.SESSION_SECRET) {
    res.status(503).json({ error: "Phone verification is not safely available yet." });
    return;
  }

  const id = digestChallenge(parsed.data.challengeId);
  try {
    const [challenge] = await db.select().from(customerPhoneChallenges)
      .where(eq(customerPhoneChallenges.id, id)).limit(1);
    if (!challenge || challenge.expiresAt.getTime() <= Date.now() || challenge.consumedAt) {
      res.status(400).json({ error: "That code has expired. Request a new one." });
      return;
    }
    if (challenge.status === "verified") {
      const existing = await db.select({ clerkUserId: customerProfiles.clerkUserId })
        .from(customerProfiles).where(eq(customerProfiles.phoneNumber, challenge.phoneNumber)).limit(1);
      if (existing.length) {
        res.status(400).json({ error: "Request a new code to sign in again." });
        return;
      }
      res.json(CheckCustomerPhoneVerificationResponse.parse({
        status: "registration_required",
        registrationToken: parsed.data.challengeId,
        signInToken: null,
      }));
      return;
    }
    if (challenge.status !== "pending" || challenge.attempts >= MAX_CODE_ATTEMPTS) {
      res.status(429).json({ error: "Too many code attempts. Request a new verification code." });
      return;
    }
    const sourceAllowed = await incrementRateLimit("source-check-hour", req.ip || "unknown", 300, 60 * 60_000);
    if (!sourceAllowed) {
      res.status(429).json({ error: "Too many code attempts. Please wait before trying again." });
      return;
    }
    const [claimed] = await db.update(customerPhoneChallenges)
      .set({ status: "checking", attempts: sql`${customerPhoneChallenges.attempts} + 1` })
      .where(and(
        eq(customerPhoneChallenges.id, id),
        eq(customerPhoneChallenges.status, "pending"),
        lt(customerPhoneChallenges.attempts, MAX_CODE_ATTEMPTS),
        gt(customerPhoneChallenges.expiresAt, new Date()),
      ))
      .returning({ phoneNumber: customerPhoneChallenges.phoneNumber });
    if (!claimed) {
      res.status(400).json({ error: "That code has expired or is already being checked." });
      return;
    }

    let approved = false;
    try {
      approved = await checkTwilioVerification(config, claimed.phoneNumber, parsed.data.code);
    } catch (error) {
      await db.update(customerPhoneChallenges)
        .set({ status: challenge.attempts + 1 >= MAX_CODE_ATTEMPTS ? "failed" : "pending" })
        .where(eq(customerPhoneChallenges.id, id));
      cleanProviderError(req, error);
      res.status(503).json({ error: "Twilio could not check the code. Please retry or request a new code." });
      return;
    }
    if (!approved) {
      const failed = challenge.attempts + 1 >= MAX_CODE_ATTEMPTS;
      await db.update(customerPhoneChallenges)
        .set({ status: failed ? "failed" : "pending" })
        .where(eq(customerPhoneChallenges.id, id));
      res.status(failed ? 429 : 400).json({
        error: failed ? "Too many attempts. Request a new verification code." : "That code is incorrect or expired.",
      });
      return;
    }

    const verifiedAt = new Date();
    await db.update(customerPhoneChallenges)
      .set({ status: "verified", phoneVerifiedAt: verifiedAt })
      .where(eq(customerPhoneChallenges.id, id));

    const [profile] = await db.select({ clerkUserId: customerProfiles.clerkUserId })
      .from(customerProfiles).where(eq(customerProfiles.phoneNumber, claimed.phoneNumber)).limit(1);
    if (profile) {
      try {
        const signIn = await clerkClient.signInTokens.createSignInToken({
          userId: profile.clerkUserId,
          expiresInSeconds: 300,
        });
        await db.update(customerPhoneChallenges)
          .set({ status: "consumed", consumedAt: new Date() })
          .where(eq(customerPhoneChallenges.id, id));
        res.json(CheckCustomerPhoneVerificationResponse.parse({
          status: "signed_in",
          registrationToken: null,
          signInToken: signIn.token,
        }));
        return;
      } catch (error) {
        cleanProviderError(req, error);
        res.status(503).json({ error: "Your verified sign-in could not be completed. Request a new code." });
        return;
      }
    }
    res.json(CheckCustomerPhoneVerificationResponse.parse({
      status: "registration_required",
      registrationToken: parsed.data.challengeId,
      signInToken: null,
    }));
  } catch (error) {
    cleanProviderError(req, error);
    res.status(503).json({ error: "The code could not be checked. Please retry shortly." });
  }
});

router.post("/auth/complete", requireCustomer, async (req, res): Promise<void> => {
  const parsed = CompleteCustomerRegistrationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Finish the verified signup steps before continuing." });
    return;
  }
  const clerkUserId = getAuth(req).userId!;
  const challengeId = digestChallenge(parsed.data.registrationToken);
  try {
    const user = await clerkClient.users.getUser(clerkUserId);
    const email = verifiedPrimaryEmail(user);
    if (!email || !user.firstName?.trim()) {
      res.status(400).json({ error: "Verify your email and enter your name before continuing." });
      return;
    }
    const [challenge] = await db.select().from(customerPhoneChallenges)
      .where(eq(customerPhoneChallenges.id, challengeId)).limit(1);
    const phoneVerifiedAt = challenge?.phoneVerifiedAt;
    if (!challenge || !phoneVerifiedAt) {
      res.status(400).json({ error: "Verify your phone number before completing signup." });
      return;
    }
    if (challenge.expiresAt.getTime() <= Date.now()) {
      res.status(400).json({ error: "Your phone verification has expired. Request a new SMS code to finish signup." });
      return;
    }

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`customer-user:${clerkUserId}`}, 0))`);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`customer-phone:${challenge.phoneNumber}`}, 0))`);
      const [existingUser] = await tx.select().from(customerProfiles)
        .where(eq(customerProfiles.clerkUserId, clerkUserId)).limit(1);
      const [existingPhone] = await tx.select().from(customerProfiles)
        .where(eq(customerProfiles.phoneNumber, challenge.phoneNumber)).limit(1);
      if (existingUser || existingPhone) {
        if (existingUser?.phoneNumber === challenge.phoneNumber && existingPhone?.clerkUserId === clerkUserId) {
          return existingUser;
        }
        return null;
      }
      if (
        challenge.status !== "verified" ||
        challenge.consumedAt ||
        challenge.expiresAt.getTime() <= Date.now()
      ) {
        return null;
      }
      const [created] = await tx.insert(customerProfiles).values({
        clerkUserId,
        phoneNumber: challenge.phoneNumber,
        email,
        firstName: user.firstName!.trim(),
        lastName: user.lastName?.trim() || null,
        phoneVerifiedAt,
        emailVerifiedAt: new Date(),
      }).returning();
      await tx.update(customerPhoneChallenges)
        .set({ status: "consumed", consumedAt: new Date() })
        .where(eq(customerPhoneChallenges.id, challengeId));
      return created;
    });
    if (!result) {
      res.status(409).json({ error: "This phone or customer account is already linked." });
      return;
    }
    res.json(CompleteCustomerRegistrationResponse.parse(result));
  } catch (error) {
    cleanProviderError(req, error);
    res.status(503).json({ error: "Your customer account could not be completed. Please retry." });
  }
});

router.get("/auth/me", requireCustomer, async (req, res): Promise<void> => {
  try {
    const userId = getAuth(req).userId!;
    const user = await clerkClient.users.getUser(userId);
    const email = verifiedPrimaryEmail(user);
    const [customer] = await db.select().from(customerProfiles)
      .where(eq(customerProfiles.clerkUserId, userId)).limit(1);
    res.json(GetCustomerAuthMeResponse.parse({
      customer: customer ?? null,
      isAdmin: isConfiguredAdmin(email),
    }));
  } catch (error) {
    cleanProviderError(req, error);
    res.status(503).json({ error: "Your customer account could not be loaded." });
  }
});

router.get("/admin/customers", requireCustomer, async (req, res): Promise<void> => {
  try {
    const user = await clerkClient.users.getUser(getAuth(req).userId!);
    if (!isConfiguredAdmin(verifiedPrimaryEmail(user))) {
      res.status(403).json({ error: "Owner access is required." });
      return;
    }
    const customers = await db.select().from(customerProfiles)
      .orderBy(desc(customerProfiles.createdAt)).limit(500);
    res.json(GetAdminCustomersResponse.parse({
      customers: customers.map((customer) => ({
        ...customer,
        phoneVerified: Boolean(customer.phoneVerifiedAt),
        emailVerified: Boolean(customer.emailVerifiedAt),
      })),
    }));
  } catch (error) {
    cleanProviderError(req, error);
    res.status(503).json({ error: "The customer directory could not be loaded." });
  }
});

export default router;
