import { Router, type IRouter } from "express";
import { db, usersTable, networkNodesTable, commissionsTable, walletsTable, activityFeedTable } from "../db";
import { eq } from "drizzle-orm";
import { appCache } from "../lib/cache";

const router: IRouter = Router();

const BINARY_CYCLE_THRESHOLD = 3000;

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Check cache first
  const cacheKey = `dashboard:summary:${userId}`;
  const cachedData = appCache.get(cacheKey);
  if (cachedData) {
    res.json(cachedData);
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [node] = await db
    .select()
    .from(networkNodesTable)
    .where(eq(networkNodesTable.userId, userId));

  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, userId));

  const commissions = await db
    .select()
    .from(commissionsTable)
    .where(eq(commissionsTable.userId, userId));

  // Count direct referrals (users whose sponsorId = current user)
  const allUsers = await db.select().from(usersTable);
  const directReferrals = allUsers.filter((u) => u.sponsorId === userId).length;

  // Count total downline using BFS
  const allNodes = await db.select().from(networkNodesTable);
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
  let totalDownline = 0;
  if (node) {
    const queue = [node.id];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const current = nodeMap.get(currentId);
      if (!current) continue;
      if (current.id !== node.id) totalDownline++;
      if (current.leftChildId) queue.push(current.leftChildId);
      if (current.rightChildId) queue.push(current.rightChildId);
    }
  }

  const leftBv = parseFloat(node?.leftBv ?? "0");
  const rightBv = parseFloat(node?.rightBv ?? "0");
  const residualLeft = parseFloat(user.residualLeftBv ?? "0");
  const residualRight = parseFloat(user.residualRightBv ?? "0");

  const effectiveLeft = residualLeft;
  const effectiveRight = residualRight;
  const pendingCycles = Math.floor(Math.min(effectiveLeft, effectiveRight) / BINARY_CYCLE_THRESHOLD);

  const nextCycleLeftNeeded = Math.max(0, BINARY_CYCLE_THRESHOLD - (effectiveLeft % BINARY_CYCLE_THRESHOLD));
  const nextCycleRightNeeded = Math.max(0, BINARY_CYCLE_THRESHOLD - (effectiveRight % BINARY_CYCLE_THRESHOLD));

  const totalEarned = commissions.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  const walletBalance = parseFloat(wallet?.availableBalance ?? "0");

  const summaryData = {
    userId,
    leftBv: effectiveLeft,
    rightBv: effectiveRight,
    directReferrals,
    totalDownline,
    walletBalance,
    totalEarned,
    pendingCycles,
    nextCycleLeftNeeded,
    nextCycleRightNeeded,
  };

  appCache.set(cacheKey, summaryData, 5 * 60 * 1000); // 5 mins cache
  res.json(summaryData);
});

router.get("/dashboard/activity", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const cacheKey = `dashboard:activity:${userId}`;
  const cachedData = appCache.get(cacheKey);
  if (cachedData) {
    res.json(cachedData);
    return;
  }

  const activities = await db
    .select()
    .from(activityFeedTable)
    .where(eq(activityFeedTable.userId, userId));

  const allUsers = await db.select().from(usersTable);
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  const responseData = activities
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 20)
    .map((a) => {
      const related = a.relatedUserId ? userMap.get(a.relatedUserId) : null;
      return {
        id: a.id,
        type: a.type,
        message: a.message,
        amount: a.amount ? parseFloat(a.amount) : null,
        relatedUserId: a.relatedUserId ?? null,
        relatedUserName: related ? `${related.firstName} ${related.lastName}` : null,
        createdAt: a.createdAt.toISOString(),
      };
    });

  appCache.set(cacheKey, responseData, 60 * 1000); // 1 minute cache
  res.json(responseData);
});

export default router;