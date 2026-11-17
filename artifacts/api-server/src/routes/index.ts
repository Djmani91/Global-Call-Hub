import { Router, type IRouter } from "express";
import healthRouter from "./health";
import twilioNumbersRouter from "./twilio-numbers";
import twilioPricingRouter from "./twilio-pricing";
import voiceRouter from "./voice";
import creditsRouter from "./credits";
import customerAuthRouter from "./customer-auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(voiceRouter);
router.use(creditsRouter);
router.use(customerAuthRouter);
router.use(twilioNumbersRouter);
router.use(twilioPricingRouter);

export default router;
