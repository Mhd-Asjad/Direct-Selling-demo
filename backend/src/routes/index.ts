import { Router, type IRouter, Request, Response, NextFunction } from "express";
import { appCache } from "../lib/cache";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import networkRouter from "./network";
import commissionsRouter from "./commissions";
import walletRouter from "./wallet";
import adminRouter from "./admin";
import coursesRouter from "./courses";
import dashboardRouter from "./dashboard";
import depositsRouter from "./deposits";

const router: IRouter = Router();

// Global cache invalidation for all mutating requests
router.use((req: Request, res: Response, next: NextFunction) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    appCache.clear();
  }
  next();
});

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(networkRouter);
router.use(commissionsRouter);
router.use(walletRouter);
router.use(adminRouter);
router.use(coursesRouter);
router.use(dashboardRouter);
router.use(depositsRouter);

export default router;

