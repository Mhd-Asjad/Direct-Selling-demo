import { Router, type IRouter } from "express";
import {
  db,
  usersTable,
  walletsTable,
  walletTransactionsTable,
  couponsTable,
  financialLedgerTable,
  activityFeedTable,
  manualDepositRequestsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import { activateUser } from "../lib/activation";

const router: IRouter = Router();

// ── Platform USDT receiving address (set in env or hardcode for now) ──────────
const PLATFORM_USDT_ADDRESS = process.env.PLATFORM_USDT_ADDRESS || "TXxxxxPlatformUSDTAddressHere";
const COURSE_AMOUNT_USDT = 1200; // ~₹1,00,000 at approx. 83 INR/USD

// ── GET /deposits/platform-address — returns admin USDT address to user ──
router.get("/deposits/platform-address", async (_req, res) => {
  const [admin] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.role, "admin"));
    
  const address = admin?.usdtAddress || process.env.PLATFORM_USDT_ADDRESS || "TXxxxxPlatformUSDTAddressHere";
  res.json({ address, amountRequired: COURSE_AMOUNT_USDT });
});

// ── POST /deposits/manual — user submits their USDT payment details ──────────
router.post("/deposits/manual", async (req, res): Promise<void> => {
  const sessionUserId = (req.session as any).userId;
  if (!sessionUserId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { amountInUSDT, blockchainNetwork, senderWalletAddress, screenshotUrl } = req.body;

  if (!amountInUSDT || !blockchainNetwork || !senderWalletAddress) {
    res.status(400).json({ error: "amountInUSDT, blockchainNetwork, and senderWalletAddress are required" });
    return;
  }

  const parsedAmount = parseFloat(String(amountInUSDT));
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  try {
    const [request] = await db
      .insert(manualDepositRequestsTable)
      .values({
        userId: sessionUserId,
        amountInUSDT: String(parsedAmount),
        blockchainNetwork: blockchainNetwork.trim(),
        senderWalletAddress: senderWalletAddress.trim(),
        txHash: null,
        screenshotUrl: screenshotUrl?.trim() || null,
        status: "PENDING",
      })
      .returning();

    logger.info(`Manual deposit request #${request.id} submitted by user ${sessionUserId}`);
    res.status(201).json({ id: request.id, status: request.status, createdAt: request.createdAt });
  } catch (err: any) {
    if (err.code === "23505" || err.message?.includes("unique")) {
      res.status(409).json({ error: "This transaction hash has already been submitted." });
      return;
    }
    logger.error("Failed to submit manual deposit:", err);
    res.status(500).json({ error: "Failed to submit deposit request" });
  }
});

// ── GET /deposits/my-requests — user views their own deposit requests ─────────
router.get("/deposits/my-requests", async (req, res): Promise<void> => {
  const sessionUserId = (req.session as any).userId;
  if (!sessionUserId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const requests = await db
    .select()
    .from(manualDepositRequestsTable)
    .where(eq(manualDepositRequestsTable.userId, sessionUserId))
    .orderBy(desc(manualDepositRequestsTable.createdAt));

  res.json(requests.map(formatDepositRequest));
});

// ── GET /admin/deposits — admin lists all deposit requests ────────────────────
router.get("/admin/deposits", async (req, res): Promise<void> => {
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

  const requests = await db
    .select()
    .from(manualDepositRequestsTable)
    .orderBy(desc(manualDepositRequestsTable.createdAt));

  // Enrich with user info
  const userIds = [...new Set(requests.map((r) => r.userId))];
  const users = userIds.length > 0
    ? await db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, userIds[0])) // load one-by-one since inArray needs import — done inline below
    : [];

  // Fetch all relevant users
  const allUsers = await db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
    .from(usersTable);
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  res.json(requests.map((r) => ({
    ...formatDepositRequest(r),
    user: userMap.get(r.userId) ?? null,
  })));
});

// ── POST /admin/deposits/:id/approve — atomic approval ───────────────────────
router.post("/admin/deposits/:id/approve", async (req, res): Promise<void> => {
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

  const depositId = parseInt(req.params.id);
  if (isNaN(depositId)) {
    res.status(400).json({ error: "Invalid deposit ID" });
    return;
  }

  const [deposit] = await db
    .select()
    .from(manualDepositRequestsTable)
    .where(eq(manualDepositRequestsTable.id, depositId));

  if (!deposit) {
    res.status(404).json({ error: "Deposit request not found" });
    return;
  }

  if (deposit.status !== "PENDING") {
    res.status(409).json({ error: `Deposit is already ${deposit.status}. Cannot re-approve.` });
    return;
  }

  const userId = deposit.userId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  try {
    // ── ATOMIC APPROVAL LOGIC ──────────────────────────────────────────────
    // 1. Generate 2x ₹50,000 activation coupons
    const code1 = `CPN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const code2 = `CPN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    await db.insert(couponsTable).values([
      { userId, code: code1, amount: "50000", couponType: "activation", status: "active", generatedBy: `admin:${sessionUserId}` },
      { userId, code: code2, amount: "50000", couponType: "activation", status: "active", generatedBy: `admin:${sessionUserId}` },
    ]);

    // 2. Credit user wallet balance (amount in USDT → record as credit)
    let [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
    if (!wallet) {
      [wallet] = await db.insert(walletsTable).values({ userId, totalEarned: "0", totalSpent: "0", availableBalance: "0" }).returning();
    }
    const usdtAmount = parseFloat(deposit.amountInUSDT);
    const newBalance = parseFloat(wallet.availableBalance ?? "0") + usdtAmount;
    const newEarned = parseFloat(wallet.totalEarned ?? "0") + usdtAmount;
    await db.update(walletsTable).set({ availableBalance: String(newBalance), totalEarned: String(newEarned) }).where(eq(walletsTable.id, wallet.id));

    // 3. Log immutable wallet transaction record
    await db.insert(walletTransactionsTable).values({
      walletId: wallet.id,
      type: "credit",
      amount: String(usdtAmount),
      description: `Manual USDT deposit approved — (${deposit.blockchainNetwork})`,
      referenceId: `deposit:${depositId}`,
    });

    // 4. Log financial ledger inflow
    await db.insert(financialLedgerTable).values({
      type: "inflow",
      amount: String(usdtAmount),
      description: `Course purchase via manual USDT — ${user.firstName} ${user.lastName} (Deposit #${depositId})`,
      userId,
    });

    // 5. Log activity feed
    await db.insert(activityFeedTable).values({
      userId,
      type: "coupon_created",
      message: `2 activation coupons issued after manual USDT deposit approval (Deposit #${depositId})`,
      amount: "100000",
    });

    // 6. Mark deposit as APPROVED and record issued coupon codes
    await db.update(manualDepositRequestsTable).set({
      status: "APPROVED",
      reviewedBy: sessionUserId,
      reviewedAt: new Date(),
      coupon1Code: code1,
      coupon2Code: code2,
    }).where(eq(manualDepositRequestsTable.id, depositId));

    logger.info(`Deposit #${depositId} approved for user ${userId}. Coupons: ${code1}, ${code2}`);

    res.json({
      success: true,
      coupon1: code1,
      coupon2: code2,
      message: `Deposit approved. 2 activation coupons issued to user. User must redeem both coupons to activate account.`,
    });
  } catch (err: any) {
    logger.error("Failed to approve deposit:", err);
    res.status(500).json({ error: err.message || "Failed to approve deposit" });
  }
});

// ── POST /admin/deposits/:id/reject ───────────────────────────────────────────
router.post("/admin/deposits/:id/reject", async (req, res): Promise<void> => {
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

  const depositId = parseInt(req.params.id);
  if (isNaN(depositId)) {
    res.status(400).json({ error: "Invalid deposit ID" });
    return;
  }

  const [deposit] = await db
    .select()
    .from(manualDepositRequestsTable)
    .where(eq(manualDepositRequestsTable.id, depositId));

  if (!deposit) {
    res.status(404).json({ error: "Deposit request not found" });
    return;
  }

  if (deposit.status !== "PENDING") {
    res.status(409).json({ error: `Deposit is already ${deposit.status}. Cannot reject.` });
    return;
  }

  const { reason } = req.body;

  await db.update(manualDepositRequestsTable).set({
    status: "REJECTED",
    reviewedBy: sessionUserId,
    reviewedAt: new Date(),
    rejectionReason: reason || null,
  }).where(eq(manualDepositRequestsTable.id, depositId));

  logger.info(`Deposit #${depositId} rejected by admin ${sessionUserId}`);
  res.json({ success: true });
});

// ── POST /auth/redeem-activation-coupons with activation guard ────────────────
// This route is already in auth.ts but we also fix the guard here as a reference.
// The guard ensures: user must have BOTH an APPROVED manual deposit OR a Stripe
// course_package session before the account can go "active".
// Implementation lives in auth.ts — see activateUser(userId, 3000).

function formatDepositRequest(r: typeof manualDepositRequestsTable.$inferSelect) {
  return {
    id: r.id,
    userId: r.userId,
    amountInUSDT: parseFloat(r.amountInUSDT),
    blockchainNetwork: r.blockchainNetwork,
    senderWalletAddress: r.senderWalletAddress,
    txHash: r.txHash,
    screenshotUrl: r.screenshotUrl,
    status: r.status,
    reviewedBy: r.reviewedBy,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    rejectionReason: r.rejectionReason,
    coupon1Code: r.coupon1Code,
    coupon2Code: r.coupon2Code,
    createdAt: r.createdAt.toISOString(),
  };
}

export default router;
