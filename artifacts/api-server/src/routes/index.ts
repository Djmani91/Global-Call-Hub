import { Router, type IRouter } from "express";
import healthRouter from "./health";
import twilioNumbersRouter from "./twilio-numbers";

const router: IRouter = Router();

router.use(healthRouter);
router.use(twilioNumbersRouter);

export default router;
