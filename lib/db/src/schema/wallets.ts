import { pgTable, text, serial, timestamp, numeric, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const walletsTable = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  totalEarned: numeric("total_earned", { precision: 12, scale: 2 }).notNull().default("0"),
  totalSpent: numeric("total_spent", { precision: 12, scale: 2 }).notNull().default("0"),
  availableBalance: numeric("available_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  pinHash: text("pin_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull(),
  type: text("type").notNull(), // credit | debit
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull(),
  referenceId: text("reference_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const couponsTable = pgTable("coupons", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  courseId: integer("course_id"),
  code: text("code").notNull().unique(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("active"), // active | redeemed | expired
  couponType: text("coupon_type").notNull().default("general"), // general | activation
  generatedBy: text("generated_by").notNull().default("system"), // system | admin_id
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  redeemedBy: integer("redeemed_by"),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Records manual payment submissions (Option 2 from workflow)
export const paymentSubmissionsTable = pgTable("payment_submissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  paymentMethod: text("payment_method").notNull(), // manual_usdt | cash_hand
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  // Manual USDT fields
  senderWalletAddress: text("sender_wallet_address"),
  transferredAmount: numeric("transferred_amount", { precision: 12, scale: 2 }),
  blockchainNetwork: text("blockchain_network"),
  paymentScreenshotUrl: text("payment_screenshot_url"),
  paymentDateTime: timestamp("payment_date_time", { withTimezone: true }),
  // Cash in-hand fields
  paymentReferenceNumber: text("payment_reference_number"),
  collectorName: text("collector_name"),
  collectorId: text("collector_id"),
  paymentDate: timestamp("payment_date", { withTimezone: true }),
  remarks: text("remarks"),
  // Admin review
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWalletSchema = createInsertSchema(walletsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof walletsTable.$inferSelect;

export const insertWalletTransactionSchema = createInsertSchema(walletTransactionsTable).omit({ id: true, createdAt: true });
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;

export const insertCouponSchema = createInsertSchema(couponsTable).omit({ id: true, createdAt: true });
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof couponsTable.$inferSelect;

export const insertPaymentSubmissionSchema = createInsertSchema(paymentSubmissionsTable).omit({ id: true, createdAt: true });
export type InsertPaymentSubmission = z.infer<typeof insertPaymentSubmissionSchema>;
export type PaymentSubmission = typeof paymentSubmissionsTable.$inferSelect;

// ─── Automated USDT / Crypto Transactions ────────────────────────────────────
// Tracks on-chain USDT payments from the automated gateway.
// txHash is UNIQUE — guarantees strict duplicate-transaction prevention.
export const cryptoTransactionsTable = pgTable("crypto_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  txHash: text("tx_hash").notNull().unique(),    // on-chain tx ID — deduplication key
  network: text("network").notNull(),             // TRC20 | ERC20 | BEP20
  fromAddress: text("from_address"),              // sender wallet (optional for web3)
  toAddress: text("to_address").notNull(),        // admin/system wallet
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull(), // USDT amount
  currency: text("currency").notNull().default("USDT"),
  status: text("status").notNull().default("pending"), // pending | confirmed | failed
  webhookSource: text("webhook_source"),          // "manual_verify" | "stripe" | "web3"
  rawPayload: text("raw_payload"),                // raw webhook JSON for audit
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCryptoTransactionSchema = createInsertSchema(cryptoTransactionsTable).omit({ id: true, createdAt: true });
export type InsertCryptoTransaction = z.infer<typeof insertCryptoTransactionSchema>;
export type CryptoTransaction = typeof cryptoTransactionsTable.$inferSelect;

// ─── Manual USDT Deposit Requests ─────────────────────────────────────────────
// Integration-free USDT deposit: user sends USDT to the platform address, then
// manually submits their transaction details here for admin review.
// txHash has a STRICT UNIQUE INDEX — prevents any duplicate submissions.
export const manualDepositRequestsTable = pgTable(
  "manual_deposit_requests",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    amountInUSDT: numeric("amount_in_usdt", { precision: 18, scale: 6 }).notNull(),
    blockchainNetwork: text("blockchain_network").notNull(), // TRC20 | ERC20 | BEP20 | etc.
    senderWalletAddress: text("sender_wallet_address").notNull(),
    txHash: text("tx_hash"),           // optional
    screenshotUrl: text("screenshot_url"),        // optional proof screenshot
    status: text("status").notNull().default("PENDING"), // PENDING | APPROVED | REJECTED
    // Admin review fields
    reviewedBy: integer("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    // On APPROVED, record what was issued
    coupon1Code: text("coupon1_code"),
    coupon2Code: text("coupon2_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  }
);

export const insertManualDepositRequestSchema = createInsertSchema(manualDepositRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertManualDepositRequest = z.infer<typeof insertManualDepositRequestSchema>;
export type ManualDepositRequest = typeof manualDepositRequestsTable.$inferSelect;