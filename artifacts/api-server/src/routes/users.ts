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

import { activateUser } from "../lib/activation";

router.post("/users/:id/approve-payment", async (req, res): Promise<void> => {
  const params = ApprovePaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  try {
    const activated = await activateUser(params.data.id);
    res.json(formatUser(activated));
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to activate user" });
  }
});

export default router;
