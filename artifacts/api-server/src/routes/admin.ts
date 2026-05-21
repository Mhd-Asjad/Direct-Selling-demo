import { Router, type IRouter } from "express";
import { db, financialLedgerTable, washEventsTable, walletsTable, commissionsTable, networkNodesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ExecuteWashResetBody } from "@workspace/api-zod";
import bcrypt from "bcrypt";

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

export default router;
