import { db, usersTable, networkNodesTable, commissionsTable, walletsTable, walletTransactionsTable, activityFeedTable, financialLedgerTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const BINARY_CYCLE_THRESHOLD = 3000;
const BINARY_CYCLE_BONUS = 70;
const DIRECT_COMMISSION_RATE = 0.1;

/**
 * Awards a 10% direct referral commission to the sponsor
 */
export async function awardDirectReferralCommission(
  newUserId: number,
  sponsorId: number,
  amount: number,
): Promise<void> {
  const commissionAmount = amount * DIRECT_COMMISSION_RATE;

  await db.insert(commissionsTable).values({
    userId: sponsorId,
    type: "direct_referral",
    amount: String(commissionAmount),
    sourceUserId: newUserId,
  });

  await creditWallet(sponsorId, commissionAmount, `Direct referral commission (10%) from new member #${newUserId}`, `commission_${newUserId}`);

  await db.insert(activityFeedTable).values({
    userId: sponsorId,
    type: "commission_earned",
    message: `Earned $${commissionAmount.toFixed(2)} direct referral commission`,
    amount: String(commissionAmount),
    relatedUserId: newUserId,
  });

  await db.insert(financialLedgerTable).values({
    type: "commission_paid",
    amount: String(commissionAmount),
    description: "Direct referral commission (10%)",
    userId: sponsorId,
  });
}

/**
 * Checks if a node has completed a binary matching cycle (3000 BV each side).
 * Awards $70 bonus per completed cycle and carries over residual.
 */
export async function checkAndAwardBinaryCycles(userId: number): Promise<void> {
  const [node] = await db
    .select()
    .from(networkNodesTable)
    .where(eq(networkNodesTable.userId, userId));

  if (!node) return;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user || user.status !== "active") return;

  const leftBv = parseFloat(node.leftBv ?? "0");
  const rightBv = parseFloat(node.rightBv ?? "0");
  const residualLeft = parseFloat(user.residualLeftBv ?? "0");
  const residualRight = parseFloat(user.residualRightBv ?? "0");

  const effectiveLeft = leftBv + residualLeft;
  const effectiveRight = rightBv + residualRight;

  const cycles = Math.floor(Math.min(effectiveLeft, effectiveRight) / BINARY_CYCLE_THRESHOLD);
  if (cycles <= 0) return;

  const bonusAmount = cycles * BINARY_CYCLE_BONUS;
  const matchedBv = cycles * BINARY_CYCLE_THRESHOLD;

  // Carry over residual
  const newResidualLeft = effectiveLeft - matchedBv;
  const newResidualRight = effectiveRight - matchedBv;

  await db
    .update(usersTable)
    .set({
      residualLeftBv: String(newResidualLeft),
      residualRightBv: String(newResidualRight),
    })
    .where(eq(usersTable.id, userId));

  await db.insert(commissionsTable).values({
    userId,
    type: "binary_match",
    amount: String(bonusAmount),
    sourceUserId: userId,
    bvMatched: String(matchedBv),
  });

  await creditWallet(userId, bonusAmount, `Binary match bonus ($${BINARY_CYCLE_BONUS} x ${cycles} cycles)`, `binary_${Date.now()}`);

  await db.insert(activityFeedTable).values({
    userId,
    type: "binary_match",
    message: `Binary match! ${cycles} cycle${cycles > 1 ? "s" : ""} completed — earned $${bonusAmount.toFixed(2)}`,
    amount: String(bonusAmount),
  });

  await db.insert(financialLedgerTable).values({
    type: "commission_paid",
    amount: String(bonusAmount),
    description: `Binary match bonus (${cycles} cycles)`,
    userId,
  });

  logger.info({ userId, cycles, bonusAmount }, "Binary match commission awarded");
}

export async function creditWallet(
  userId: number,
  amount: number,
  description: string,
  referenceId?: string,
): Promise<void> {
  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, userId));

  if (!wallet) {
    // Create wallet
    await db.insert(walletsTable).values({
      userId,
      totalEarned: String(amount),
      availableBalance: String(amount),
    });
    // Insert tx
    const [newWallet] = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, userId));
    if (newWallet) {
      await db.insert(walletTransactionsTable).values({
        walletId: newWallet.id,
        type: "credit",
        amount: String(amount),
        description,
        referenceId,
      });
    }
    return;
  }

  const newBalance = parseFloat(wallet.availableBalance ?? "0") + amount;
  const newEarned = parseFloat(wallet.totalEarned ?? "0") + amount;

  await db
    .update(walletsTable)
    .set({ availableBalance: String(newBalance), totalEarned: String(newEarned) })
    .where(eq(walletsTable.userId, userId));

  await db.insert(walletTransactionsTable).values({
    walletId: wallet.id,
    type: "credit",
    amount: String(amount),
    description,
    referenceId,
  });
}

export async function debitWallet(
  userId: number,
  amount: number,
  description: string,
  referenceId?: string,
): Promise<boolean> {
  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, userId));

  if (!wallet) return false;

  const currentBalance = parseFloat(wallet.availableBalance ?? "0");
  if (currentBalance < amount) return false;

  const newBalance = currentBalance - amount;
  const newSpent = parseFloat(wallet.totalSpent ?? "0") + amount;

  await db
    .update(walletsTable)
    .set({ availableBalance: String(newBalance), totalSpent: String(newSpent) })
    .where(eq(walletsTable.userId, userId));

  await db.insert(walletTransactionsTable).values({
    walletId: wallet.id,
    type: "debit",
    amount: String(amount),
    description,
    referenceId,
  });

  return true;
}
