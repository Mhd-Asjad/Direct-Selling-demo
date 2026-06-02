import { Router, type IRouter } from "express";
import { db, commissionsTable, usersTable, networkNodesTable } from "../db";
import { eq } from "drizzle-orm";
import { ListCommissionsQueryParams, GetCommissionStatsQueryParams } from "../api-zod";

import { appCache } from "../lib/cache";

const router: IRouter = Router();

const BINARY_CYCLE_THRESHOLD = 3000;

router.get("/commissions", async (req, res): Promise<void> => {
  const sessionUserId = (req.session as any).userId;
  const params = ListCommissionsQueryParams.safeParse(req.query);

  const userId = (params.success && params.data.userId) ? params.data.userId : sessionUserId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const cacheKey = `commissions:${userId}:${params.success ? params.data.type || 'all' : 'all'}`;
  const cachedData = appCache.get(cacheKey);
  if (cachedData) {
    res.json(cachedData);
    return;
  }

  let allCommissions = await db
    .select()
    .from(commissionsTable)
    .where(eq(commissionsTable.userId, userId));

  if (params.success && params.data.type) {
    allCommissions = allCommissions.filter((c) => c.type === params.data.type);
  }

  // Enrich with source user names
  const userIds = [...new Set(allCommissions.map((c) => c.sourceUserId))];
  let users: any[] = [];
  if (userIds.length > 0) {
    users = await db.select().from(usersTable); // Note: Could be optimized with `inArray` if needed
  }
  const userMap = new Map(users.map((u) => [u.id, u]));

  const enriched = allCommissions
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((c) => {
      const sourceUser = userMap.get(c.sourceUserId);
      return {
        id: c.id,
        userId: c.userId,
        type: c.type,
        amount: parseFloat(c.amount),
        sourceUserId: c.sourceUserId,
        sourceUserName: sourceUser
          ? `${sourceUser.firstName} ${sourceUser.lastName}`
          : null,
        bvMatched: c.bvMatched ? parseFloat(c.bvMatched) : null,
        createdAt: c.createdAt.toISOString(),
      };
    });

  appCache.set(cacheKey, enriched, 60 * 1000); // 1 minute cache
  res.json(enriched);
});

router.get("/commissions/stats", async (req, res): Promise<void> => {
  const sessionUserId = (req.session as any).userId;
  const params = GetCommissionStatsQueryParams.safeParse(req.query);
  const userId = (params.success && params.data.userId) ? params.data.userId : sessionUserId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const cacheKey = `commissions:stats:${userId}`;
  const cachedData = appCache.get(cacheKey);
  if (cachedData) {
    res.json(cachedData);
    return;
  }

  const commissions = await db
    .select()
    .from(commissionsTable)
    .where(eq(commissionsTable.userId, userId));

  const totalEarned = commissions.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  const directReferralTotal = commissions
    .filter((c) => c.type === "direct_referral")
    .reduce((sum, c) => sum + parseFloat(c.amount), 0);
  const binaryMatchTotal = commissions
    .filter((c) => c.type === "binary_match")
    .reduce((sum, c) => sum + parseFloat(c.amount), 0);

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const [node] = await db.select().from(networkNodesTable).where(eq(networkNodesTable.userId, userId));

  const leftBv = parseFloat(node?.leftBv ?? "0");
  const rightBv = parseFloat(node?.rightBv ?? "0");
  const residualLeft = parseFloat(user?.residualLeftBv ?? "0");
  const residualRight = parseFloat(user?.residualRightBv ?? "0");

  const effectiveLeft = leftBv + residualLeft;
  const effectiveRight = rightBv + residualRight;
  const matchedBv = Math.min(effectiveLeft, effectiveRight);
  const pendingCycles = Math.floor(matchedBv / BINARY_CYCLE_THRESHOLD);

  const responseData = {
    totalEarned,
    directReferralTotal,
    binaryMatchTotal,
    pendingCycles,
    leftBv,
    rightBv,
    matchedBv,
    residualLeftBv: residualLeft,
    residualRightBv: residualRight,
  };

  appCache.set(cacheKey, responseData, 5 * 60 * 1000); // 5 minutes cache
  res.json(responseData);
});

export default router;
