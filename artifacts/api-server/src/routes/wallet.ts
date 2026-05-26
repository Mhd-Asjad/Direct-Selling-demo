import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, walletsTable, walletTransactionsTable, couponsTable, activityFeedTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { VerifyWalletPinBody, UpdateWalletPinBody, CreateCouponBody, RedeemCouponBody } from "@workspace/api-zod";
import { debitWallet, creditWallet } from "../lib/commissions";

const router: IRouter = Router();

function generateCouponCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "COUPON-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code + "-MLM";
}

router.get("/wallet", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  let [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));

  if (!wallet) {
    const [created] = await db
      .insert(walletsTable)
      .values({ userId, totalEarned: "0", totalSpent: "0", availableBalance: "0" })
      .returning();
    wallet = created;
  }

  res.json({
    id: wallet.id,
    userId: wallet.userId,
    walletId: wallet.walletId ?? null,
    totalEarned: parseFloat(wallet.totalEarned ?? "0"),
    totalSpent: parseFloat(wallet.totalSpent ?? "0"),
    availableBalance: parseFloat(wallet.availableBalance ?? "0"),
    hasPin: !!wallet.pinHash,
    createdAt: wallet.createdAt.toISOString(),
  });
});

router.get("/wallet/transactions", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (!wallet) {
    res.json([]);
    return;
  }

  const transactions = await db
    .select()
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.walletId, wallet.id));

  res.json(
    transactions
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((t) => ({
        id: t.id,
        walletId: t.walletId,
        type: t.type,
        amount: parseFloat(t.amount),
        description: t.description,
        referenceId: t.referenceId ?? null,
        createdAt: t.createdAt.toISOString(),
      })),
  );
});

router.post("/wallet/pin/verify", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const body = VerifyWalletPinBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (!wallet || !wallet.pinHash) {
    res.status(401).json({ error: "No PIN set" });
    return;
  }

  const valid = await bcrypt.compare(body.data.pin, wallet.pinHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid PIN" });
    return;
  }

  res.json({ valid: true });
});

router.patch("/wallet/pin", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const body = UpdateWalletPinBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));

  // If PIN exists, require current PIN
  if (wallet?.pinHash && body.data.currentPin) {
    const valid = await bcrypt.compare(body.data.currentPin, wallet.pinHash);
    if (!valid) {
      res.status(401).json({ error: "Current PIN is incorrect" });
      return;
    }
  }

  const pinHash = await bcrypt.hash(body.data.pin, 10);

  if (!wallet) {
    const [created] = await db
      .insert(walletsTable)
      .values({ userId, totalEarned: "0", totalSpent: "0", availableBalance: "0", pinHash })
      .returning();
    res.json({
      id: created.id,
      userId: created.userId,
      totalEarned: 0,
      totalSpent: 0,
      availableBalance: 0,
      hasPin: true,
      createdAt: created.createdAt.toISOString(),
    });
    return;
  }

  const [updated] = await db
    .update(walletsTable)
    .set({ pinHash })
    .where(eq(walletsTable.userId, userId))
    .returning();

  res.json({
    id: updated.id,
    userId: updated.userId,
    totalEarned: parseFloat(updated.totalEarned ?? "0"),
    totalSpent: parseFloat(updated.totalSpent ?? "0"),
    availableBalance: parseFloat(updated.availableBalance ?? "0"),
    hasPin: true,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.get("/wallet/coupons", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const coupons = await db.select().from(couponsTable).where(eq(couponsTable.userId, userId));

  res.json(
    coupons
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((c) => ({
        id: c.id,
        userId: c.userId,
        code: c.code,
        amount: parseFloat(c.amount),
        status: c.status,
        redeemedAt: c.redeemedAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
  );
});

router.post("/wallet/coupons", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const body = CreateCouponBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  // Verify PIN
  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (!wallet?.pinHash) {
    res.status(400).json({ error: "Please set a wallet PIN first" });
    return;
  }

  const pinValid = await bcrypt.compare(body.data.pin, wallet.pinHash);
  if (!pinValid) {
    res.status(400).json({ error: "Invalid PIN" });
    return;
  }

  const balance = parseFloat(wallet.availableBalance ?? "0");
  if (balance < body.data.amount) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }

  // Debit wallet
  await debitWallet(userId, body.data.amount, `Coupon generated for $${body.data.amount}`);

  // Create coupon
  const code = generateCouponCode();
  const [coupon] = await db
    .insert(couponsTable)
    .values({
      userId,
      code,
      amount: String(body.data.amount),
      status: "active",
    })
    .returning();

  await db.insert(activityFeedTable).values({
    userId,
    type: "coupon_created",
    message: `Generated coupon ${code} worth $${body.data.amount}`,
    amount: String(body.data.amount),
  });

  res.status(201).json({
    id: coupon.id,
    userId: coupon.userId,
    code: coupon.code,
    amount: parseFloat(coupon.amount),
    status: coupon.status,
    redeemedAt: null,
    createdAt: coupon.createdAt.toISOString(),
  });
});

router.post("/wallet/coupons/redeem", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const body = RedeemCouponBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [coupon] = await db
    .select()
    .from(couponsTable)
    .where(eq(couponsTable.code, body.data.code));

  if (!coupon) {
    res.status(400).json({ error: "Coupon not found" });
    return;
  }

  if (coupon.status !== "active") {
    res.status(400).json({ error: "Coupon is already used or expired" });
    return;
  }

  const couponAmount = parseFloat(coupon.amount);
  const now = new Date();
  const [updated] = await db
    .update(couponsTable)
    .set({ status: "redeemed", redeemedAt: now })
    .where(eq(couponsTable.code, body.data.code))
    .returning();

  // ✅ Credit the coupon value into the user's wallet balance
  await creditWallet(userId, couponAmount, `Coupon redeemed: ${body.data.code}`, `coupon:${coupon.id}`);

  await db.insert(activityFeedTable).values({
    userId,
    type: "coupon_redeemed",
    message: `Redeemed coupon ${body.data.code} worth $${couponAmount.toFixed(2)} — balance credited`,
    amount: coupon.amount,
  });

  res.json({
    id: updated.id,
    userId: updated.userId,
    code: updated.code,
    amount: parseFloat(updated.amount),
    status: updated.status,
    redeemedAt: updated.redeemedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
