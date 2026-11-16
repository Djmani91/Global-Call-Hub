import { Router, type IRouter } from "express";
import healthRouter from "./health";
import twilioNumbersRouter from "./twilio-numbers";
import twilioPricingRouter from "./twilio-pricing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(twilioNumbersRouter);
router.use(twilioPricingRouter);

export default router;
