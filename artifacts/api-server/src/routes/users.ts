import { Router, type IRouter } from "express";
import { db, usersTable, networkNodesTable, walletsTable, activityFeedTable, financialLedgerTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
import { UpdateUserBody, UpdateUserStatusBody, ListUsersQueryParams, GetUserParams, UpdateUserParams, UpdateUserStatusParams, ApprovePaymentParams } from "@workspace/api-zod";
import { formatUser } from "./auth";
import { bfsPlacement, propagateBv } from "../lib/bfs";
import { awardDirectReferralCommission, checkAndAwardBinaryCycles, creditWallet } from "../lib/commissions";

const router: IRouter = Router();

const REGISTRATION_FEE = 30;
const BV_PER_REGISTRATION = 30;

router.get("/users", async (req, res): Promise<void> => {
  const params = ListUsersQueryParams.safeParse(req.query);
  let query = db.select().from(usersTable);

  const users = await db.select().from(usersTable);
  let filtered = users;

  if (params.success) {
    if (params.data.status) {
      filtered = filtered.filter((u) => u.status === params.data.status);
    }
    if (params.data.search) {
      const s = params.data.search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.firstName.toLowerCase().includes(s) ||
          u.lastName.toLowerCase().includes(s) ||
          u.email.toLowerCase().includes(s),
      );
    }
  }

  res.json(filtered.map(formatUser));
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, params.data.id));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(formatUser(user));
});

router.patch("/users/:id", async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const body = UpdateUserBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(body.data)
    .where(eq(usersTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(formatUser(updated));
});

router.patch("/users/:id/status", async (req, res): Promise<void> => {
  const params = UpdateUserStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const body = UpdateUserStatusBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ status: body.data.status })
    .where(eq(usersTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(formatUser(updated));
});

router.post("/users/:id/approve-payment", async (req, res): Promise<void> => {
  const params = ApprovePaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, params.data.id));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.status === "active") {
    res.status(400).json({ error: "User already active" });
    return;
  }

  // Activate user
  const [activated] = await db
    .update(usersTable)
    .set({ status: "active" })
    .where(eq(usersTable.id, user.id))
    .returning();

  // Create wallet
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

  // BFS tree placement
  let parentNodeId: number | null = null;
  let placementLeg: "left" | "right" = "left";

  if (user.sponsorId) {
    const [sponsorNode] = await db
      .select()
      .from(networkNodesTable)
      .where(eq(networkNodesTable.userId, user.sponsorId));

    if (sponsorNode) {
      const placement = await bfsPlacement(sponsorNode.id);
      if (placement) {
        parentNodeId = placement.parentId;
        placementLeg = placement.leg;
      }
    }
  }

  // Get parent node depth
  let depth = 0;
  if (parentNodeId) {
    const [parentNode] = await db
      .select()
      .from(networkNodesTable)
      .where(eq(networkNodesTable.id, parentNodeId));
    if (parentNode) depth = (parentNode.depth ?? 0) + 1;
  }

  // Create tree node
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

  // Update parent's child pointer
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

  // Propagate BV upward
  await propagateBv(newNode.id, BV_PER_REGISTRATION);

  // Log inflow
  await financialLedgerTable && await db.insert(financialLedgerTable).values({
    type: "inflow",
    amount: String(REGISTRATION_FEE),
    description: `Registration fee from ${user.firstName} ${user.lastName}`,
    userId: user.id,
  });

  // Award direct referral commission (10%) to sponsor
  if (user.sponsorId) {
    await awardDirectReferralCommission(user.id, user.sponsorId, REGISTRATION_FEE);
    await checkAndAwardBinaryCycles(user.sponsorId);
  }

  // Activity feed
  await db.insert(activityFeedTable).values({
    userId: user.id,
    type: "registration",
    message: `Welcome! Your account has been activated.`,
    amount: null,
  });

  res.json(formatUser(activated));
});

export default router;
