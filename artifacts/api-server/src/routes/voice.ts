import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import {
  CreateVoiceTokenBody, GetVoiceReadinessResponse, HandleVoiceWebhookBody,
} from "@workspace/api-zod";
import {
  canonicalWebhookUrl, validVoiceSignature, voiceReadiness, VOICE_DISABLED_MESSAGE,
} from "../services/voice";

export const requireVoiceCustomer: RequestHandler = (req, res, next) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Sign in to your Linea account first." });
    return;
  }
  next();
};

const router: IRouter = Router();
router.use("/voice", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.get("/voice/readiness", (_req, res) => {
  res.json(GetVoiceReadinessResponse.parse(voiceReadiness));
});
router.post("/voice/token", requireVoiceCustomer, (req, res) => {
  // Reject, rather than silently ignore, identity/caller ID overrides.
  const parsed = CreateVoiceTokenBody.safeParse(req.body);
  if (!parsed.success || !req.body || Object.keys(req.body).some(k => k !== "platform") ||
      Object.keys(req.query).length) {
    res.status(400).json({ error: "Supply only the installed app platform: ios or android." });
    return;
  }
  // Hard stop before reading assignments, signing tokens or contacting Twilio.
  res.status(503).json({ error: VOICE_DISABLED_MESSAGE });
});

router.post("/voice/webhooks/:direction", (req, res) => {
  if (req.params.direction !== "incoming" && req.params.direction !== "outgoing") {
    res.sendStatus(400); return;
  }
  if (!req.is("application/x-www-form-urlencoded")) {
    res.sendStatus(415); return;
  }
  const signature = req.get("X-Twilio-Signature");
  if (!signature) { res.sendStatus(403); return; }
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const url = canonicalWebhookUrl(process.env.VOICE_WEBHOOK_ORIGIN, req.originalUrl);
  if (!authToken || !accountSid || !url) { res.sendStatus(503); return; }
  // All fields must be flat strings; preserve unknown future fields for signature verification.
  if (!req.body || Object.values(req.body).some(v => typeof v !== "string") ||
      !validVoiceSignature(authToken, signature, url, req.body)) {
    res.sendStatus(403); return;
  }
  if (req.body.AccountSid !== accountSid) { res.sendStatus(403); return; }
  if (!HandleVoiceWebhookBody.safeParse(req.body).success) {
    res.sendStatus(400); return;
  }
  // Even correctly signed requests must not connect while native/abuse prerequisites are blocked.
  // No Dial, Redirect, recording or REST Calls API is reachable.
  res.type("application/xml").send('<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="rejected"/></Response>');
});
export default router;
