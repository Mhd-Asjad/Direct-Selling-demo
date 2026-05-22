import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import networkRouter from "./network";
import commissionsRouter from "./commissions";
import walletRouter from "./wallet";
import adminRouter from "./admin";
import coursesRouter from "./courses";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(networkRouter);
router.use(commissionsRouter);
router.use(walletRouter);
router.use(adminRouter);
router.use(coursesRouter);
router.use(dashboardRouter);

export default router;
