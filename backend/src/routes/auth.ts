import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, usersTable, networkNodesTable, walletsTable, activityFeedTable, financialLedgerTable, couponsTable, cryptoTransactionsTable, manualDepositRequestsTable } from "../db";
import { eq, and, inArray } from "drizzle-orm";
import { RegisterUserBody, LoginUserBody, GetCurrentUserResponse, PendingRegistration, StripeCreateCheckoutSessionBody, StripeVerifyCheckoutSessionBody } from "../api-zod";
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
    res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
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

  // Validate wallet ID uniqueness if provided
  const rawWalletId = (data as any).walletId;
  const normalizedWalletId = rawWalletId ? rawWalletId.trim().toUpperCase() : null;
  if (normalizedWalletId) {
    const [existingWallet] = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.walletId, normalizedWalletId));
    if (existingWallet) {
      res.status(400).json({ error: "Wallet ID already taken. Please choose a different one." });
      return;
    }
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

  // Provision wallet immediately, saving the custom walletId
  await db.insert(walletsTable).values({
    userId: newUser.id,
    walletId: normalizedWalletId ?? null,
    totalEarned: "0",
    totalSpent: "0",
    availableBalance: "0",
  });

  res.status(201).json({
    id: newUser.id,
    email: newUser.email,
    status: newUser.status,
    walletId: normalizedWalletId,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
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
    res.clearCookie("connect.sid");
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
  let sponsorName = null;
  if (user.sponsorId) {
    const [sponsor] = await db
      .select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable)
      .where(eq(usersTable.id, user.sponsorId));
    if (sponsor) {
      sponsorName = `${sponsor.firstName} ${sponsor.lastName}`;
    }
  }

  res.json({
    ...formatUser(user),
    sponsorName,
  });
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
    isKycVerified: user.isKycVerified,
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

router.post("/auth/create-course-checkout-session", async (req, res): Promise<void> => {
  const { userId } = req.body;
  if (typeof userId !== "number") {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(400).json({ error: "User not found" });
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
            currency: "inr", // ₹1,00,000
            product_data: {
              name: "₹1,00,000 Course Package",
              description: "Provides 2x ₹50,000 activation coupons",
            },
            unit_amount: 10000000, // 100,000.00 INR
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        userId: String(userId),
        type: "course_package"
      },
      success_url: `${req.headers.origin || "http://localhost:5173"}/dashboard?course_payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || "http://localhost:5173"}/dashboard?course_payment=cancelled`,
    });

    res.json({
      sessionId: session.id,
      url: session.url!,
    });
  } catch (error: any) {
    logger.error("Failed to create Stripe session for course:", error);
    res.status(400).json({ error: error.message || "Failed to create payment session" });
  }
});

router.post("/auth/create-checkout-session", async (req, res): Promise<void> => {
  const parsed = StripeCreateCheckoutSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
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
    res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
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
    const sessionType = session.metadata?.type;

    if (sessionType === "course_package") {
      // ✅ Fully activate user for course purchase
      const activatedUser = await activateUser(userId, 3000, 1000);

      // Log to financial ledger so admin can see it in Overview
      const [existingLog] = await db
        .select()
        .from(financialLedgerTable)
        .where(
          and(
            eq(financialLedgerTable.userId, userId),
            eq(financialLedgerTable.type, "inflow")
          )
        );
      if (!existingLog) {
        await db.insert(financialLedgerTable).values({
          type: "inflow",
          amount: session.amount_total ? (session.amount_total / 100).toString() : "1200.00",
          description: `Course package purchase — ${activatedUser.firstName} ${activatedUser.lastName} via Stripe (Session: ${sessionId})`,
          userId,
        });
      }

      res.json({
        success: true,
        status: activatedUser.status,
      });
      return;
    }

    const [updatedUser] = await db
      .update(usersTable)
      .set({ isPaid: true })
      .where(eq(usersTable.id, userId))
      .returning();

    if (!updatedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Log financial inflow if not already present
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
        amount: session.amount_total ? (session.amount_total / 100).toString() : "30.00",
        description: `Registration fee from ${updatedUser.firstName} ${updatedUser.lastName} via Stripe`,
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
    const sessionType = session.metadata?.type;
    
    if (userIdStr) {
      const userId = parseInt(userIdStr);
      try {
        // Strict duplicate transaction prevention: record session.id in cryptoTransactionsTable
        try {
          await db.insert(cryptoTransactionsTable).values({
            userId,
            txHash: session.id, // Use Stripe session ID as the unique txHash
            network: "stripe",
            toAddress: "system",
            amount: session.amount_total ? (session.amount_total / 100).toString() : "0",
            currency: session.currency || "USD",
            status: "confirmed",
            webhookSource: "stripe",
            confirmedAt: new Date()
          });
        } catch (dbErr: any) {
          if (dbErr.code === "23505" || dbErr.message?.includes("unique constraint")) {
            logger.info(`Webhook skipped: Stripe session ${session.id} already processed.`);
            res.json({ received: true, skipped: "duplicate" });
            return;
          }
          throw dbErr;
        }

        if (sessionType === "course_package") {
          // Direct activation for Stripe course purchase (no coupons needed)
          await activateUser(userId, 3000, 1000);
          logger.info(`Successfully activated user ${userId} directly via Stripe Webhook`);
        } else {
          // Original logic for $30 fee
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
        } // Close else block
      } catch (err: any) {
        logger.error(`Failed to record Stripe payment/coupons for user ${userId} in webhook: ${err.message}`);
      }
    }
  }

  res.json({ received: true });
});

router.post("/auth/redeem-activation-coupons", async (req, res): Promise<void> => {
  const { userId, coupon1, coupon2 } = req.body;
  if (typeof userId !== "number" || typeof coupon1 !== "string" || typeof coupon2 !== "string") {
    res.status(400).json({ error: "Invalid request payload" });
    return;
  }

  if (coupon1 === coupon2) {
    res.status(400).json({ error: "Coupons must be different" });
    return;
  }

  // Fetch both coupons
  const coupons = await db
    .select()
    .from(couponsTable)
    .where(
      and(
        eq(couponsTable.userId, userId),
        eq(couponsTable.status, "active"),
        eq(couponsTable.couponType, "activation"),
        inArray(couponsTable.code, [coupon1, coupon2])
      )
    );

  if (coupons.length !== 2) {
    res.status(400).json({ error: "Invalid, inactive, or mismatched coupons. Both must be active activation coupons owned by you." });
    return;
  }

  // Validate combined coupon value meets the course activation threshold
  const COURSE_AMOUNT_INR = 100000; // ₹1,00,000
  const totalCouponValue = coupons.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  if (totalCouponValue < COURSE_AMOUNT_INR) {
    res.status(400).json({
      error: `Combined coupon value (₹${totalCouponValue.toLocaleString()}) is less than the required course amount of ₹${COURSE_AMOUNT_INR.toLocaleString()}. Please ensure both coupons are valid activation coupons worth ₹50,000 each.`
    });
    return;
  }

  // ── COUPON LEGITIMACY GUARD ───────────────────────────────────────────────
  // The coupons themselves are the proof: they must be active, of type
  // 'activation', owned by the user, and their combined value ≥ ₹1,00,000.
  // This handles all paths: admin-issued, USDT deposit approval, Stripe purchase.

  try {
    // Redeem both coupons
    await db
      .update(couponsTable)
      .set({ status: "redeemed", redeemedBy: userId, redeemedAt: new Date() })
      .where(inArray(couponsTable.id, coupons.map(c => c.id)));

    // Activate the user with 3000 BV
    const activatedUser = await activateUser(userId, 3000, 1000);

    res.json({
      success: true,
      status: activatedUser.status,
    });
  } catch (error: any) {
    logger.error("Failed to redeem activation coupons:", error);
    res.status(400).json({ error: error.message || "Failed to redeem coupons and activate account" });
  }
});

export default router;
