import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, usersTable, networkNodesTable, walletsTable, activityFeedTable, financialLedgerTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { RegisterUserBody, LoginUserBody, GetCurrentUserResponse, PendingRegistration, StripeCreateCheckoutSessionBody, StripeVerifyCheckoutSessionBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import Stripe from "stripe";
import { activateUser } from "../lib/activation";

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
      packageType: data.packageType ?? null,
      username: data.username,
      state: data.state,
      city: data.city,
      dob: data.dob,
      gender: data.gender,
      profilePhoto: data.profilePhoto,
      govtIdProof: data.govtIdProof,
      sponsorReferralId: data.sponsorReferralId ?? null,
      placementSide: data.placementSide ?? null,
      usdtAddress: data.usdtAddress ?? null,
      bankDetails: data.bankDetails ?? null,
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
    isPaid: user.isPaid,
    role: user.role,
    referralCode: user.referralCode,
    referrerId: user.referrerId ?? null,
    packageType: user.packageType ?? null,
    username: user.username ?? null,
    state: user.state ?? null,
    city: user.city ?? null,
    dob: user.dob ?? null,
    gender: user.gender ?? null,
    profilePhoto: user.profilePhoto ?? null,
    govtIdProof: user.govtIdProof ?? null,
    sponsorReferralId: user.sponsorReferralId ?? null,
    placementSide: user.placementSide ?? null,
    usdtAddress: user.usdtAddress ?? null,
    bankDetails: user.bankDetails ?? null,
    leftBv: parseFloat(user.leftBv ?? "0"),
    rightBv: parseFloat(user.rightBv ?? "0"),
    createdAt: user.createdAt.toISOString(),
  };
}

router.post("/auth/create-checkout-session", async (req, res): Promise<void> => {
  const parsed = StripeCreateCheckoutSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { userId } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(400).json({ error: "User not found" });
    return;
  }

  if (user.status === "active") {
    res.status(400).json({ error: "User already active" });
    return;
  }

  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "sk_test_51MockKeyDontUseInProdChangeThis";
    const stripe = new Stripe(stripeSecretKey);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "NetPro Distributor Registration",
              description: "Lifetime distributor account activation registration fee",
            },
            unit_amount: 3000, // $30.00
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        userId: String(userId),
      },
      success_url: `${req.headers.origin || "http://localhost:5173"}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || "http://localhost:5173"}/dashboard?payment=cancelled`,
    });

    res.json({
      sessionId: session.id,
      url: session.url!,
    });
  } catch (error: any) {
    logger.error("Failed to create Stripe session:", error);
    res.status(400).json({ error: error.message || "Failed to create payment session" });
  }
});

router.post("/auth/verify-checkout-session", async (req, res): Promise<void> => {
  const parsed = StripeVerifyCheckoutSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { sessionId } = parsed.data;

  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "sk_test_51MockKeyDontUseInProdChangeThis";
    const stripe = new Stripe(stripeSecretKey);

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      res.status(400).json({ error: "Payment not completed" });
      return;
    }

    const userIdStr = session.metadata?.userId;
    if (!userIdStr) {
      res.status(400).json({ error: "No userId in session metadata" });
      return;
    }

    const userId = parseInt(userIdStr);
    
    // Update user to record they paid (keep status as pending until KYC approved)
    const [updatedUser] = await db
      .update(usersTable)
      .set({ isPaid: true })
      .where(eq(usersTable.id, userId))
      .returning();

    if (!updatedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Log the financial ledger inflow if it hasn't been logged yet
    const existingInflows = await db
      .select()
      .from(financialLedgerTable)
      .where(
        and(
          eq(financialLedgerTable.userId, userId),
          eq(financialLedgerTable.type, "inflow")
        )
      );

    if (existingInflows.length === 0) {
      await db.insert(financialLedgerTable).values({
        type: "inflow",
        amount: "30.00",
        description: `Registration fee from ${updatedUser.firstName} ${updatedUser.lastName} via Stripe (Pending KYC)`,
        userId: updatedUser.id,
      });
    }

    res.json({
      success: true,
      status: updatedUser.status,
    });
  } catch (error: any) {
    logger.error("Stripe session verification failed:", error);
    res.status(400).json({ error: error.message || "Verification failed" });
  }
});

router.post("/stripe/webhook", async (req, res): Promise<void> => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "sk_test_51MockKeyDontUseInProdChangeThis";
  const stripe = new Stripe(stripeSecretKey);

  const sig = req.headers["stripe-signature"] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const rawBody = (req as any).rawBody || req.body;
    if (endpointSecret && sig) {
      event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    } else {
      // Local dev mode fallback or signature skipped
      event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    }
  } catch (err: any) {
    logger.error(`Webhook Error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userIdStr = session.metadata?.userId;
    if (userIdStr) {
      const userId = parseInt(userIdStr);
      try {
        // Record payment in DB
        const [updatedUser] = await db
          .update(usersTable)
          .set({ isPaid: true })
          .where(eq(usersTable.id, userId))
          .returning();

        if (updatedUser) {
          // Log financial inflow if not already logged
          const existingInflows = await db
            .select()
            .from(financialLedgerTable)
            .where(
              and(
                eq(financialLedgerTable.userId, userId),
                eq(financialLedgerTable.type, "inflow")
              )
            );

          if (existingInflows.length === 0) {
            await db.insert(financialLedgerTable).values({
              type: "inflow",
              amount: "30.00",
              description: `Registration fee from ${updatedUser.firstName} ${updatedUser.lastName} via Stripe (Pending KYC)`,
              userId: updatedUser.id,
            });
          }
          logger.info(`Successfully recorded Stripe payment for user ${userId} via Webhook (Pending KYC)`);
        }
      } catch (err: any) {
        logger.error(`Failed to record Stripe payment for user ${userId} in webhook: ${err.message}`);
      }
    }
  }

  res.json({ received: true });
});

export default router;
