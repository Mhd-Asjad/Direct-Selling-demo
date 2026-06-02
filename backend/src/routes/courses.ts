import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, coursesTable, usersTable, networkNodesTable, walletsTable, couponsTable, activityFeedTable, financialLedgerTable } from "../db";
import { eq } from "drizzle-orm";
import { PurchaseCourseBody } from "../api-zod";
import { propagateBv, getAncestorUserIds } from "../lib/bfs";
import { awardDirectReferralCommission, checkAndAwardBinaryCycles, debitWallet } from "../lib/commissions";

const router: IRouter = Router();

function generateCouponCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "CRS-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function maskName(firstName: string, lastName: string): string {
  const maskedFirst = firstName.charAt(0) + "***";
  const maskedLast = lastName.charAt(0) + "***";
  return `${maskedFirst} ${maskedLast}`;
}

router.get("/courses", async (_req, res): Promise<void> => {
  const courses = await db
    .select()
    .from(coursesTable)
    .where(eq(coursesTable.isActive, true));

  res.json(
    courses.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description ?? null,
      price: parseFloat(c.price),
      minPrice: c.minPrice ? parseFloat(c.minPrice) : null,
      maxPrice: c.maxPrice ? parseFloat(c.maxPrice) : null,
      bvAmount: parseFloat(c.bvAmount ?? "3000"),
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
    })),
  );
});

router.get("/courses/referral", async (req, res): Promise<void> => {
  const courseId = parseInt(req.query.courseId as string);
  const refCode = req.query.refCode as string;

  if (!courseId || !refCode) {
    res.status(400).json({ error: "courseId and refCode are required" });
    return;
  }

  const [course] = await db
    .select()
    .from(coursesTable)
    .where(eq(coursesTable.id, courseId));

  if (!course || !course.isActive) {
    res.status(404).json({ error: "Course not found or inactive" });
    return;
  }

  const [sponsor] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.referralCode, refCode));

  if (!sponsor || sponsor.status !== "active") {
    res.status(404).json({ error: "Referral code not found or sponsor not active" });
    return;
  }

  res.json({
    course: {
      id: course.id,
      name: course.name,
      description: course.description ?? null,
      price: parseFloat(course.price),
      minPrice: course.minPrice ? parseFloat(course.minPrice) : null,
      maxPrice: course.maxPrice ? parseFloat(course.maxPrice) : null,
      bvAmount: parseFloat(course.bvAmount ?? "3000"),
      isActive: course.isActive,
      createdAt: course.createdAt.toISOString(),
    },
    sponsorCode: sponsor.referralCode,
    sponsorName: maskName(sponsor.firstName, sponsor.lastName),
    isValid: true,
  });
});

router.post("/courses/purchase", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const body = PurchaseCourseBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { courseId, referralCode, pin } = body.data;

  // Get course
  const [course] = await db
    .select()
    .from(coursesTable)
    .where(eq(coursesTable.id, courseId));

  if (!course || !course.isActive) {
    res.status(404).json({ error: "Course not found or inactive" });
    return;
  }

  const coursePrice = parseFloat(course.price);
  const bvAmount = parseFloat(course.bvAmount ?? "3000");

  // Validate sponsor via referral code
  const [sponsor] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.referralCode, referralCode));

  if (!sponsor || sponsor.status !== "active") {
    res.status(400).json({ error: "Invalid or inactive referral code" });
    return;
  }

  // Get purchasing user
  const [purchaser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!purchaser || purchaser.status !== "active") {
    res.status(403).json({ error: "Your account must be active to purchase courses" });
    return;
  }

  // Verify PIN if wallet has a PIN set
  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, userId));

  if (wallet?.pinHash) {
    if (!pin) {
      res.status(400).json({ error: "Wallet PIN required to purchase" });
      return;
    }
    const pinValid = await bcrypt.compare(pin, wallet.pinHash);
    if (!pinValid) {
      res.status(401).json({ error: "Invalid wallet PIN" });
      return;
    }
  }

  // Debit course price from wallet
  const debitOk = await debitWallet(
    userId,
    coursePrice,
    `Course purchase: ${course.name}`,
    `course_${courseId}_${Date.now()}`,
  );

  if (!debitOk) {
    res.status(400).json({ error: `Insufficient wallet balance. Course price: $${coursePrice.toFixed(2)}` });
    return;
  }

  // Get user's network node and assign BV
  const [userNode] = await db
    .select()
    .from(networkNodesTable)
    .where(eq(networkNodesTable.userId, userId));

  if (userNode) {
    await propagateBv(userNode.id, bvAmount);

    // Check binary cycles for all ancestors
    const ancestorUserIds = await getAncestorUserIds(userNode.id);
    for (const ancestorUserId of ancestorUserIds) {
      await checkAndAwardBinaryCycles(ancestorUserId);
    }
  }

  // Generate admin coupon for the purchaser
  const couponCode = generateCouponCode();
  await db.insert(couponsTable).values({
    userId,
    courseId,
    code: couponCode,
    amount: String(coursePrice),
    status: "active",
  });

  // Award 10% direct referral commission to sponsor
  await awardDirectReferralCommission(userId, sponsor.id, coursePrice);
  const directCommission = coursePrice * 0.1;

  // Log financial inflow
  await db.insert(financialLedgerTable).values({
    type: "inflow",
    amount: String(coursePrice),
    description: `Course purchase: ${course.name} by user #${userId}`,
    userId,
  });

  // Activity feed
  await db.insert(activityFeedTable).values({
    userId,
    type: "course_purchase",
    message: `Purchased course "${course.name}" — ${bvAmount} BV assigned`,
    amount: String(coursePrice),
    relatedUserId: sponsor.id,
  });

  res.status(201).json({
    couponCode,
    bvAssigned: bvAmount,
    directCommission,
    course: {
      id: course.id,
      name: course.name,
      description: course.description ?? null,
      price: coursePrice,
      minPrice: course.minPrice ? parseFloat(course.minPrice) : null,
      maxPrice: course.maxPrice ? parseFloat(course.maxPrice) : null,
      bvAmount,
      isActive: course.isActive,
      createdAt: course.createdAt.toISOString(),
    },
  });
});

export default router;
