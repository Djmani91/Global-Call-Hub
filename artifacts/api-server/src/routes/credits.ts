import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { GetBillingReadinessResponse, HandleCreditWebhookBody } from "@workspace/api-zod";
import { billingReadiness, readWallet, reconcileWallet } from "../services/credits";
import { validWebhookAuthorization } from "../services/credit-policy";
import { requireVoiceCustomer } from "./voice";

const router: IRouter = Router();
router.use("/billing", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.get("/billing/readiness", (_req, res) => {
  res.json(GetBillingReadinessResponse.parse(billingReadiness()));
});
router.get("/billing/wallet", requireVoiceCustomer, async (req, res): Promise<void> => {
  try { res.json(await readWallet(getAuth(req).userId!)); }
  catch { res.status(503).json({ error: "Your wallet could not be loaded. Please retry." }); }
});
// Local throttling complements idempotent transactions. This cannot grant money.
const refreshes = new Map<string, number>();
router.post("/billing/reconcile", requireVoiceCustomer, async (req, res): Promise<void> => {
  if ((req.body && Object.keys(req.body).length) || Object.keys(req.query).length) {
    res.status(400).json({ error: "No purchase identity, amount or other input is accepted." }); return;
  }
  const customerId = getAuth(req).userId!;
  if ((refreshes.get(customerId) ?? 0) > Date.now() - 5000) {
    res.status(503).json({ error: "Verification is already refreshing. Please retry shortly." }); return;
  }
  if (refreshes.size > 1000) refreshes.clear();
  refreshes.set(customerId, Date.now());
  try { res.json(await reconcileWallet(customerId)); }
  catch { res.status(503).json({ error: "Purchase verification is not available yet. No unverified credit was added; please retry." }); }
});
router.post("/billing/webhook", async (req, res): Promise<void> => {
  if (!process.env.REVENUECAT_WEBHOOK_AUTHORIZATION) { res.sendStatus(503); return; }
  if (!validWebhookAuthorization(req.get("Authorization"), process.env.REVENUECAT_WEBHOOK_AUTHORIZATION)) {
    res.sendStatus(403); return;
  }
  const parsed = HandleCreditWebhookBody.safeParse(req.body);
  if (!parsed.success) { res.sendStatus(400); return; }
  const event = parsed.data.event;
  if (event.type === "TEST") { res.sendStatus(204); return; }
  if (!["NON_RENEWING_PURCHASE", "CANCELLATION", "REFUND_REVERSED"].includes(event.type)) {
    // TRANSFER is deliberately not a wallet transfer. Credit remains attached to original identity.
    res.sendStatus(204); return;
  }
  if (!event.app_id || ![process.env.REVENUECAT_TEST_STORE_APP_ID, process.env.REVENUECAT_GOOGLE_PLAY_STORE_APP_ID].includes(event.app_id) ||
      !event.app_user_id || !/^user_[a-zA-Z0-9]+$/.test(event.app_user_id)) { res.sendStatus(400); return; }
  try { await reconcileWallet(event.app_user_id); res.sendStatus(204); }
  catch { res.sendStatus(503); } // Provider retries; never acknowledge failed accounting.
});
export default router;
