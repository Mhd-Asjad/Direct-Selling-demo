import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, usersTable, networkNodesTable, walletsTable, activityFeedTable, financialLedgerTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RegisterUserBody, LoginUserBody, GetCurrentUserResponse, PendingRegistration } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { bfsPlacement } from "../lib/bfs";
import { awardDirectReferralCommission, checkAndAwardBinaryCycles, creditWallet } from "../lib/commissions";
import { propagateBv } from "../lib/bfs";

const router: IRouter = Router();

function maskName(firstName: string, lastName: string): string {
  const maskedFirst = firstName.charAt(0) + "***";
  const maskedLast = lastName.charAt(0) + "***";
  return `${maskedFirst} ${maskedLast}`;
}

function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

router.get("/auth/verify-referral", async (req, res): Promise<void> => {
  const refId = req.query.refId as string;
  if (!refId) {
    res.status(400).json({ error: "refId is required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.referralCode, refId));

  if (!user || user.status !== "active") {
    res.status(404).json({ error: "Referral code not found or sponsor not active" });
    return;
  }

  res.json({
    referrerId: user.referralCode,
    maskedName: maskName(user.firstName, user.lastName),
    isValid: true,
  });
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;

  if (data.password !== data.confirmPassword) {
    res.status(400).json({ error: "Passwords do not match" });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, data.email));

  if (existing) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  // Validate referrer
  let sponsorId: number | undefined;
  if (data.referrerId) {
    const [sponsor] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.referralCode, data.referrerId));
    if (!sponsor || sponsor.status !== "active") {
      res.status(400).json({ error: "Invalid referral code" });
      return;
    }
    sponsorId = sponsor.id;
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const referralCode = generateReferralCode();

  const [newUser] = await db
    .insert(usersTable)
    .values({
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      mobileNumber: data.mobileNumber,
      address: data.address,
      countryCode: data.countryCode ?? "US",
      status: "pending",
      referralCode,
      referrerId: data.referrerId,
      sponsorId,
      packageType: data.packageType,
    })
    .returning();

  res.status(201).json({
    id: newUser.id,
    email: newUser.email,
    status: newUser.status,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email));

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Store session
  (req.session as any).userId = user.id;

  res.json(formatUser(user));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.sendStatus(204);
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json(formatUser(user));
});

export function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    mobileNumber: user.mobileNumber ?? null,
    address: user.address ?? null,
    countryCode: user.countryCode ?? null,
    status: user.status,
    role: user.role,
    referralCode: user.referralCode,
    referrerId: user.referrerId ?? null,
    packageType: user.packageType ?? null,
    leftBv: parseFloat(user.leftBv ?? "0"),
    rightBv: parseFloat(user.rightBv ?? "0"),
    createdAt: user.createdAt.toISOString(),
  };
}

export default router;
