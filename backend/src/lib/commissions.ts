import { db, usersTable, networkNodesTable, commissionsTable, walletsTable, walletTransactionsTable, activityFeedTable, financialLedgerTable } from "../db";
import { eq, and } from "drizzle-orm";
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

  await creditWallet(sponsorId, commissionAmount, `Direct referral commission (10%) from user #${newUserId}`, `commission_${newUserId}`);

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
 * Checks if a node has completed a binary matching cycle (3,000 BV each side).
 * Awards exactly $70 per completed cycle. Tracks paid cycles via commissions table
 * to avoid double-paying. Awards $70 only when both Left AND Right legs match at 3,000 BV.
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

  const unmatchedLeft = parseFloat(user.residualLeftBv ?? "0");
  const unmatchedRight = parseFloat(user.residualRightBv ?? "0");

  // Both sides must have at least BINARY_CYCLE_THRESHOLD BV for a match
  if (unmatchedLeft < BINARY_CYCLE_THRESHOLD || unmatchedRight < BINARY_CYCLE_THRESHOLD) return;

  // A new cycle fires only when BOTH sides have >= 3,000 BV unmatched
  const newCycles = Math.floor(Math.min(unmatchedLeft, unmatchedRight) / BINARY_CYCLE_THRESHOLD);
  if (newCycles <= 0) return;

  const bonusAmount = newCycles * BINARY_CYCLE_BONUS;
  const matchedBv = newCycles * BINARY_CYCLE_THRESHOLD;

  // Update residual BV for the user
  const newResidualLeft = unmatchedLeft - matchedBv;
  const newResidualRight = unmatchedRight - matchedBv;

  await db
    .update(usersTable)
    .set({
      residualLeftBv: String(newResidualLeft),
      residualRightBv: String(newResidualRight)
    })
    .where(eq(usersTable.id, userId));

  await db.insert(commissionsTable).values({
    userId,
    type: "binary_match",
    amount: String(bonusAmount),
    sourceUserId: userId,
    bvMatched: String(matchedBv),
  });

  await creditWallet(userId, bonusAmount, `Binary match bonus ($${BINARY_CYCLE_BONUS} × ${newCycles} cycle${newCycles > 1 ? "s" : ""})`, `binary_${Date.now()}`);

  await db.insert(activityFeedTable).values({
    userId,
    type: "binary_match",
    message: `Binary match! ${newCycles} cycle${newCycles > 1 ? "s" : ""} completed — earned $${bonusAmount.toFixed(2)}`,
    amount: String(bonusAmount),
  });

  await db.insert(financialLedgerTable).values({
    type: "commission_paid",
    amount: String(bonusAmount),
    description: `Binary match bonus (${newCycles} cycle${newCycles > 1 ? "s" : ""} × $${BINARY_CYCLE_BONUS})`,
    userId,
  });

  logger.info({ userId, newCycles, bonusAmount, unmatchedLeft, unmatchedRight }, "Binary match commission awarded");
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
    const [newWallet] = await db
      .insert(walletsTable)
      .values({
        userId,
        totalEarned: String(amount),
        availableBalance: String(amount),
      })
      .returning();
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
