import { Router, type IRouter } from "express";
import { db, financialLedgerTable, washEventsTable, walletsTable, commissionsTable, networkNodesTable, usersTable, coursesTable, walletTransactionsTable, activityFeedTable, couponsTable, cryptoTransactionsTable } from "../db";
import { eq } from "drizzle-orm";
import { ExecuteWashResetBody, CreateAdminCourseBody, UpdateAdminCourseBody } from "../api-zod";
import bcrypt from "bcrypt";
import { activateUser } from "../lib/activation";
import { creditWallet } from "../lib/commissions";
import { appCache } from "../lib/cache";

const router: IRouter = Router();

const OVERHEAD_RATE = 0.30;
const COMMISSION_RATE = 0.10;
const RETENTION_RATE = 0.60;

router.get("/admin/financial-stats", async (_req, res): Promise<void> => {
  const cacheKey = "admin:financial-stats";
  const cachedData = appCache.get(cacheKey);
  if (cachedData) {
    res.json(cachedData);
    return;
  }

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

  const responseData = {
    totalInflow,
    totalCommissionPaid,
    totalExpenses,
    totalOutflow,
    washRatio,
    isInsolvent,
    retentionPool: totalInflow * RETENTION_RATE,
    overheadPool: totalInflow * OVERHEAD_RATE,
    commissionPool: totalInflow * COMMISSION_RATE,
  };

  appCache.set(cacheKey, responseData, 5 * 60 * 1000); // 5 min cache
  res.json(responseData);
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
  const cacheKey = "admin:bv-stats";
  const cachedData = appCache.get(cacheKey);
  if (cachedData) {
    res.json(cachedData);
    return;
  }

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

  const responseData = {
    globalLeftBv,
    globalRightBv,
    totalMatchedCycles,
    totalBonusPaid,
    activeMemberCount,
  };

  appCache.set(cacheKey, responseData, 5 * 60 * 1000); // 5 min cache
  res.json(responseData);
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


// ── POST /admin/transfer-activation — issue 2 activation coupons to a user ─────
// Replaces direct activation: issues 2 × ₹50,000 activation coupons the user
// can redeem as USDT balance OR use both together to activate their account.
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
    const normalizedWalletId = targetWalletId.trim().toUpperCase();
    const [wallet] = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.walletId, normalizedWalletId));
      
    if (wallet) {
      resolvedUserId = wallet.userId;
    } else if (!isNaN(Number(normalizedWalletId))) {
      resolvedUserId = parseInt(normalizedWalletId, 10);
    } else {
      res.status(404).json({ error: `No user found with Wallet ID: ${normalizedWalletId}` });
      return;
    }
  } else if (targetUserId && typeof targetUserId === "number") {
    resolvedUserId = targetUserId;
  } else {
    res.status(400).json({ error: "Provide either targetWalletId (string) or targetUserId (number)" });
    return;
  }

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
    // Issue 2 × ₹50,000 activation coupons — same flow as USDT deposit approval.
    // The user can redeem them as USDT balance OR use both to activate their account.
    const code1 = `CPN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const code2 = `CPN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    await db.insert(couponsTable).values([
      { userId: resolvedUserId, code: code1, amount: "50000", couponType: "activation", status: "active", generatedBy: `admin:${sessionUserId}` },
      { userId: resolvedUserId, code: code2, amount: "50000", couponType: "activation", status: "active", generatedBy: `admin:${sessionUserId}` },
    ]);

    // Log financial ledger inflow
    const creditAmount = typeof amountUSDT === "number" && amountUSDT > 0 ? amountUSDT : 1200;
    await db.insert(financialLedgerTable).values({
      type: "inflow",
      amount: String(creditAmount),
      description: `Admin USDT transfer — ${targetUser.firstName} ${targetUser.lastName} (admin #${sessionUserId})${note ? `: ${note}` : ""}`,
      userId: resolvedUserId,
    });

    // Log activity feed
    await db.insert(activityFeedTable).values({
      userId: resolvedUserId,
      type: "coupon_created",
      message: `2 activation coupons issued by admin${note ? ` (${note})` : " after USDT transfer"}`,
      amount: "100000",
    });

    const [activatedWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, resolvedUserId));

    res.json({
      success: true,
      userId: resolvedUserId,
      walletId: activatedWallet?.walletId ?? null,
      coupon1: code1,
      coupon2: code2,
      message: `2 activation coupons (₹50,000 each) issued to ${targetUser.firstName} ${targetUser.lastName}. They can redeem as USDT or use both to activate their account.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to issue coupons" });
  }
});

// ── POST /admin/issue-coupons ─ Admin issues 2 activation coupons to a user ────────
// This is the primary manual activation path: admin verifies offline/cash payment
// and issues coupons the user can then redeem on their dashboard.
router.post("/admin/issue-coupons", async (req, res): Promise<void> => {
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

  const { targetWalletId, targetUserId, note } = req.body;

  // Resolve user
  let resolvedUserId: number | null = null;
  if (targetWalletId && typeof targetWalletId === "string") {
    const normalized = targetWalletId.trim().toUpperCase();
    const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.walletId, normalized));
    if (wallet) {
      resolvedUserId = wallet.userId;
    } else if (!isNaN(Number(normalized))) {
      resolvedUserId = parseInt(normalized, 10);
    } else {
      res.status(404).json({ error: `No user found with Wallet ID: ${normalized}` });
      return;
    }
  } else if (typeof targetUserId === "number") {
    resolvedUserId = targetUserId;
  } else {
    res.status(400).json({ error: "Provide either targetWalletId (string) or targetUserId (number)" });
    return;
  }

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
    const code1 = `CPN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const code2 = `CPN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    await db.insert(couponsTable).values([
      { userId: resolvedUserId, code: code1, amount: "50000", couponType: "activation", status: "active", generatedBy: `admin:${sessionUserId}` },
      { userId: resolvedUserId, code: code2, amount: "50000", couponType: "activation", status: "active", generatedBy: `admin:${sessionUserId}` },
    ]);

    // Log in activity feed
    await db.insert(activityFeedTable).values({
      userId: resolvedUserId,
      type: "coupon_created",
      message: `2 activation coupons issued by admin${note ? `: ${note}` : " (manual/offline payment)"}`,
      amount: "100000",
    });

    res.json({
      success: true,
      coupon1: code1,
      coupon2: code2,
      message: `2 activation coupons issued to ${targetUser.firstName} ${targetUser.lastName}. Share these codes with the user to activate their account.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to issue coupons" });
  }
});

// ── GET /admin/stripe-payments — list Stripe course purchase transactions ────
router.get("/admin/stripe-payments", async (req, res): Promise<void> => {
  const sessionUserId = (req.session as any).userId;
  if (!sessionUserId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [admin] = await db.select().from(usersTable).where(eq(usersTable.id, sessionUserId));
  if (!admin || admin.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }

  const transactions = await db.select().from(cryptoTransactionsTable).where(eq(cryptoTransactionsTable.network, "stripe"));
  const allUsers = await db.select().from(usersTable);
  const userMap = new Map(allUsers.map(u => [u.id, u]));

  res.json(
    transactions
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(tx => {
        const u = userMap.get(tx.userId);
        return {
          id: tx.id,
          userId: tx.userId,
          userName: u ? `${u.firstName} ${u.lastName}` : null,
          userEmail: u?.email ?? null,
          userStatus: u?.status ?? null,
          isKycVerified: u?.isKycVerified ?? false,
          txHash: tx.txHash,
          amount: parseFloat(tx.amount),
          currency: tx.currency,
          status: tx.status,
          confirmedAt: tx.confirmedAt?.toISOString() ?? null,
          createdAt: tx.createdAt.toISOString(),
        };
      })
  );
});

// ── POST /admin/users/:id/approve-kyc — mark user as KYC verified ──────────
router.post("/admin/users/:id/approve-kyc", async (req, res): Promise<void> => {
  const sessionUserId = (req.session as any).userId;
  if (!sessionUserId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [admin] = await db.select().from(usersTable).where(eq(usersTable.id, sessionUserId));
  if (!admin || admin.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }

  const targetId = parseInt(req.params.id);
  const [updated] = await db
    .update(usersTable)
    .set({ isKycVerified: true })
    .where(eq(usersTable.id, targetId))
    .returning();

  if (!updated) { res.status(404).json({ error: "User not found" }); return; }



  await db.insert(activityFeedTable).values({
    userId: targetId,
    type: "registration",
    message: `KYC verified by admin #${sessionUserId}`,
    amount: null,
  });

  res.json({ success: true, isKycVerified: true });
});

// ── GET /admin/users/:id/profile — rich user profile for admin ──────────────
router.get("/admin/users/:id/profile", async (req, res): Promise<void> => {
  const sessionUserId = (req.session as any).userId;
  if (!sessionUserId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [admin] = await db.select().from(usersTable).where(eq(usersTable.id, sessionUserId));
  if (!admin || admin.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }

  const targetId = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, targetId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, targetId));
  const [networkNode] = await db.select().from(networkNodesTable).where(eq(networkNodesTable.userId, targetId));

  let sponsor = null;
  if (user.sponsorId) {
    const [s] = await db.select().from(usersTable).where(eq(usersTable.id, user.sponsorId));
    if (s) sponsor = { id: s.id, firstName: s.firstName, lastName: s.lastName, email: s.email, referralCode: s.referralCode };
  }

  const downlineNodes = await db.select().from(networkNodesTable).where(eq(networkNodesTable.sponsorId, targetId));

  res.json({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    username: user.username ?? null,
    mobileNumber: user.mobileNumber ?? null,
    address: user.address ?? null,
    state: user.state ?? null,
    city: user.city ?? null,
    dob: user.dob ?? null,
    gender: user.gender ?? null,
    countryCode: user.countryCode ?? null,
    status: user.status,
    isPaid: user.isPaid,
    isKycVerified: user.isKycVerified,
    role: user.role,
    packageType: user.packageType ?? null,
    referralCode: user.referralCode,
    placementSide: user.placementSide ?? null,
    usdtAddress: user.usdtAddress ?? null,
    profilePhoto: user.profilePhoto ?? null,
    govtIdProof: user.govtIdProof ?? null,
    leftBv: parseFloat(user.leftBv ?? "0"),
    rightBv: parseFloat(user.rightBv ?? "0"),
    walletId: wallet?.walletId ?? null,
    walletBalance: parseFloat(wallet?.availableBalance ?? "0"),
    totalEarned: parseFloat(wallet?.totalEarned ?? "0"),
    sponsor,
    networkDepth: networkNode?.depth ?? null,
    networkLeg: networkNode?.leg ?? null,
    downlineCount: downlineNodes.length,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
