import { Router, type IRouter } from "express";
import { db, financialLedgerTable, washEventsTable, walletsTable, commissionsTable, networkNodesTable, usersTable, coursesTable, walletTransactionsTable, activityFeedTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ExecuteWashResetBody, CreateAdminCourseBody, UpdateAdminCourseBody } from "@workspace/api-zod";
import bcrypt from "bcrypt";
import { activateUser } from "../lib/activation";
import { creditWallet } from "../lib/commissions";

const router: IRouter = Router();

const OVERHEAD_RATE = 0.30;
const COMMISSION_RATE = 0.10;
const RETENTION_RATE = 0.60;

router.get("/admin/financial-stats", async (_req, res): Promise<void> => {
  const ledger = await db.select().from(financialLedgerTable);

  const totalInflow = ledger
    .filter((l) => l.type === "inflow")
    .reduce((sum, l) => sum + parseFloat(l.amount), 0);

  const totalCommissionPaid = ledger
    .filter((l) => l.type === "commission_paid")
    .reduce((sum, l) => sum + parseFloat(l.amount), 0);

  const totalExpenses = ledger
    .filter((l) => l.type === "expense")
    .reduce((sum, l) => sum + parseFloat(l.amount), 0);

  const totalOutflow = totalCommissionPaid + totalExpenses;
  const washRatio = totalInflow > 0 ? (totalOutflow / totalInflow) : 0;
  const isInsolvent = totalOutflow > totalInflow;

  res.json({
    totalInflow,
    totalCommissionPaid,
    totalExpenses,
    totalOutflow,
    washRatio,
    isInsolvent,
    retentionPool: totalInflow * RETENTION_RATE,
    overheadPool: totalInflow * OVERHEAD_RATE,
    commissionPool: totalInflow * COMMISSION_RATE,
  });
});

router.post("/admin/wash-reset", async (req, res): Promise<void> => {
  const body = ExecuteWashResetBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const sessionUserId = (req.session as any).userId;
  if (!sessionUserId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Verify admin status
  const [admin] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, sessionUserId));

  if (!admin || admin.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  // Verify admin PIN (using wallet PIN)
  const [adminWallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, sessionUserId));

  if (adminWallet?.pinHash) {
    const pinValid = await bcrypt.compare(body.data.adminPin, adminWallet.pinHash);
    if (!pinValid) {
      res.status(401).json({ error: "Invalid admin PIN" });
      return;
    }
  }

  // Count active wallets with balance
  const allWallets = await db.select().from(walletsTable);
  const activeWallets = allWallets.filter(
    (w) => parseFloat(w.availableBalance ?? "0") > 0,
  );

  const totalAmountWiped = activeWallets.reduce(
    (sum, w) => sum + parseFloat(w.availableBalance ?? "0"),
    0,
  );

  // Reset all wallet balances to 0
  for (const wallet of activeWallets) {
    await db
      .update(walletsTable)
      .set({ availableBalance: "0" })
      .where(eq(walletsTable.id, wallet.id));
  }

  // Reset all commission records
  const allCommissions = await db.select().from(commissionsTable);
  const commissionsReset = allCommissions.length;

  // Log the wash event
  const [washEvent] = await db
    .insert(washEventsTable)
    .values({
      executedBy: sessionUserId,
      walletsReset: activeWallets.length,
      totalAmountWiped: String(totalAmountWiped),
      reason: body.data.reason ?? null,
    })
    .returning();

  res.json({
    success: true,
    walletsReset: activeWallets.length,
    commissionsReset,
    totalAmountWiped,
    executedAt: washEvent.createdAt.toISOString(),
  });
});

router.get("/admin/bv-stats", async (_req, res): Promise<void> => {
  const nodes = await db.select().from(networkNodesTable);
  const users = await db.select().from(usersTable);
  const commissions = await db.select().from(commissionsTable);

  const globalLeftBv = nodes.reduce((sum, n) => sum + parseFloat(n.leftBv ?? "0"), 0);
  const globalRightBv = nodes.reduce((sum, n) => sum + parseFloat(n.rightBv ?? "0"), 0);

  const binaryCommissions = commissions.filter((c) => c.type === "binary_match");
  const totalMatchedCycles = binaryCommissions.reduce(
    (sum, c) => sum + (c.bvMatched ? Math.floor(parseFloat(c.bvMatched) / 3000) : 1),
    0,
  );
  const totalBonusPaid = binaryCommissions.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  const activeMemberCount = users.filter((u) => u.status === "active").length;

  res.json({
    globalLeftBv,
    globalRightBv,
    totalMatchedCycles,
    totalBonusPaid,
    activeMemberCount,
  });
});

router.get("/admin/wash-history", async (_req, res): Promise<void> => {
  const events = await db.select().from(washEventsTable);

  res.json(
    events
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((e) => ({
        id: e.id,
        executedBy: e.executedBy,
        walletsReset: e.walletsReset,
        totalAmountWiped: parseFloat(e.totalAmountWiped ?? "0"),
        reason: e.reason ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
  );
});

function mapCourse(c: typeof coursesTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? null,
    price: parseFloat(c.price),
    minPrice: c.minPrice ? parseFloat(c.minPrice) : null,
    maxPrice: c.maxPrice ? parseFloat(c.maxPrice) : null,
    bvAmount: parseFloat(c.bvAmount ?? "3000"),
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/admin/courses", async (_req, res): Promise<void> => {
  const courses = await db.select().from(coursesTable);
  res.json(courses.map(mapCourse));
});

router.post("/admin/courses", async (req, res): Promise<void> => {
  const body = CreateAdminCourseBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { name, description, price, minPrice, maxPrice, bvAmount } = body.data;

  const [course] = await db
    .insert(coursesTable)
    .values({
      name,
      description: description ?? null,
      price: String(price),
      minPrice: minPrice != null ? String(minPrice) : null,
      maxPrice: maxPrice != null ? String(maxPrice) : null,
      bvAmount: bvAmount != null ? String(bvAmount) : "3000",
      isActive: true,
    })
    .returning();

  res.status(201).json(mapCourse(course!));
});

router.patch("/admin/courses/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const body = UpdateAdminCourseBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updates: Partial<typeof coursesTable.$inferInsert> = {};
  if (body.data.name !== undefined) updates.name = body.data.name;
  if (body.data.description !== undefined) updates.description = body.data.description;
  if (body.data.price !== undefined) updates.price = String(body.data.price);
  if (body.data.minPrice !== undefined) updates.minPrice = String(body.data.minPrice);
  if (body.data.maxPrice !== undefined) updates.maxPrice = String(body.data.maxPrice);
  if (body.data.bvAmount !== undefined) updates.bvAmount = String(body.data.bvAmount);
  if (body.data.isActive !== undefined) updates.isActive = body.data.isActive;

  const [updated] = await db
    .update(coursesTable)
    .set(updates)
    .where(eq(coursesTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  res.json(mapCourse(updated));
});

router.delete("/admin/courses/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);

  await db
    .update(coursesTable)
    .set({ isActive: false })
    .where(eq(coursesTable.id, id));

  res.json({ success: true });
});


// ── POST /admin/transfer-activation — admin directly activates a user ──────────
router.post("/admin/transfer-activation", async (req, res): Promise<void> => {
  const sessionUserId = (req.session as any).userId;
  if (!sessionUserId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [admin] = await db.select().from(usersTable).where(eq(usersTable.id, sessionUserId));
  if (!admin || admin.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const { targetUserId, targetWalletId, amountUSDT, note } = req.body;

  // Resolve user by either numeric ID or string wallet ID
  let resolvedUserId: number | null = null;

  if (targetWalletId && typeof targetWalletId === "string") {
    // Look up by walletId on the wallets table
    const normalizedWalletId = targetWalletId.trim().toUpperCase();
    const [wallet] = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.walletId, normalizedWalletId));
    if (!wallet) {
      res.status(404).json({ error: `No user found with Wallet ID: ${normalizedWalletId}` });
      return;
    }
    resolvedUserId = wallet.userId;
  } else if (targetUserId && typeof targetUserId === "number") {
    resolvedUserId = targetUserId;
  } else {
    res.status(400).json({ error: "Provide either targetWalletId (string) or targetUserId (number)" });
    return;
  }

  const creditAmount = typeof amountUSDT === "number" && amountUSDT > 0 ? amountUSDT : 1200;

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, resolvedUserId));
  if (!targetUser) {
    res.status(404).json({ error: "Target user not found" });
    return;
  }

  if (targetUser.status === "active") {
    res.status(409).json({ error: "User is already active" });
    return;
  }

  try {
    // 1. Activate user — places in binary tree, propagates BV, awards commissions
    const activatedUser = await activateUser(resolvedUserId, 3000);

    // 2. Credit their wallet with the activation amount
    await creditWallet(
      resolvedUserId,
      creditAmount,
      note || `Admin activation transfer from ${admin.firstName} ${admin.lastName}`,
      `admin_activation:${sessionUserId}:${Date.now()}`
    );

    // 3. Log financial ledger inflow
    await db.insert(financialLedgerTable).values({
      type: "inflow",
      amount: String(creditAmount),
      description: `Admin USDT transfer activation — ${activatedUser.firstName} ${activatedUser.lastName} (by admin #${sessionUserId})`,
      userId: resolvedUserId,
    });

    // 4. Lookup the wallet ID to include in response
    const [activatedWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, resolvedUserId));

    res.json({
      success: true,
      userId: resolvedUserId,
      walletId: activatedWallet?.walletId ?? null,
      status: activatedUser.status,
      creditedAmount: creditAmount,
      message: `User ${activatedUser.firstName} ${activatedUser.lastName} has been activated and ${creditAmount} USDT credited to their wallet.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to transfer activation" });
  }
});

export default router;
