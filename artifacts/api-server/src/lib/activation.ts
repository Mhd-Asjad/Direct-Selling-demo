import { db, usersTable, networkNodesTable, walletsTable, activityFeedTable, financialLedgerTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { bfsPlacement, propagateBv } from "./bfs";
import { awardDirectReferralCommission, checkAndAwardBinaryCycles } from "./commissions";

const REGISTRATION_FEE = 30;
const BV_PER_REGISTRATION = 30;

/**
 * Activates a pending user, places them into the binary MLM tree,
 * processes BV propagation, distributes sponsor commissions, and updates E-Wallet/financial feeds.
 */
export async function activateUser(userId: number, bvAmount: number = BV_PER_REGISTRATION) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    throw new Error("User not found");
  }

  if (user.status === "active") {
    return user; // Already active, idempotency guard
  }

  // 1. Activate user status and ensure isPaid is set to true
  const [activated] = await db
    .update(usersTable)
    .set({ status: "active", isPaid: true })
    .where(eq(usersTable.id, user.id))
    .returning();

  // 2. Provision E-Wallet
  const [existingWallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, user.id));

  if (!existingWallet) {
    await db.insert(walletsTable).values({
      userId: user.id,
      totalEarned: "0",
      totalSpent: "0",
      availableBalance: "0",
    });
  }

  // 3. Perform BFS binary tree placement
  let parentNodeId: number | null = null;
  let placementLeg: "left" | "right" = "left";

  if (user.sponsorId) {
    const [sponsorNode] = await db
      .select()
      .from(networkNodesTable)
      .where(eq(networkNodesTable.userId, user.sponsorId));

    if (sponsorNode) {
      const preferredLeg = (user.placementSide === "left" || user.placementSide === "right")
        ? user.placementSide
        : "left";
      const placement = await bfsPlacement(sponsorNode.id, preferredLeg);
      if (placement) {
        parentNodeId = placement.parentId;
        placementLeg = placement.leg;
      }
    }
  }

  // 4. Calculate depth of parent node
  let depth = 0;
  if (parentNodeId) {
    const [parentNode] = await db
      .select()
      .from(networkNodesTable)
      .where(eq(networkNodesTable.id, parentNodeId));
    if (parentNode) depth = (parentNode.depth ?? 0) + 1;
  }

  // 5. Create new node in the network tree
  const [newNode] = await db
    .insert(networkNodesTable)
    .values({
      userId: user.id,
      parentId: parentNodeId,
      sponsorId: user.sponsorId,
      leg: placementLeg,
      depth,
    })
    .returning();

  // 6. Update parent node child links
  if (parentNodeId) {
    if (placementLeg === "left") {
      await db
        .update(networkNodesTable)
        .set({ leftChildId: newNode.id })
        .where(eq(networkNodesTable.id, parentNodeId));
    } else {
      await db
        .update(networkNodesTable)
        .set({ rightChildId: newNode.id })
        .where(eq(networkNodesTable.id, parentNodeId));
    }
  }

  // 7. Propagate BV upwards through sponsor path
  await propagateBv(newNode.id, bvAmount);

  // 8. Log financial ledger inflow if it hasn't been logged yet (e.g. if paid via bank/cash manually rather than Stripe)
  if (!user.isPaid) {
    await db.insert(financialLedgerTable).values({
      type: "inflow",
      amount: String(REGISTRATION_FEE),
      description: `Registration fee from ${user.firstName} ${user.lastName} (Manual approval)`,
      userId: user.id,
    });
  }

  // 9. Award direct referral commission (10%) to the sponsor and check binary cycles
  if (user.sponsorId) {
    await awardDirectReferralCommission(user.id, user.sponsorId, REGISTRATION_FEE);
    await checkAndAwardBinaryCycles(user.sponsorId);
  }

  // 10. Record onboarding in activity feed
  await db.insert(activityFeedTable).values({
    userId: user.id,
    type: "registration",
    message: `Welcome! Your account has been activated.`,
    amount: null,
  });

  return activated;
}
