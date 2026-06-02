import { pgTable, text, serial, timestamp, numeric, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  mobileNumber: text("mobile_number"),
  address: text("address"),
  countryCode: text("country_code").default("US"),
  status: text("status").notNull().default("pending"), // pending | active | suspended
  isPaid: boolean("is_paid").notNull().default(false),
  isKycVerified: boolean("is_kyc_verified").notNull().default(false),
  role: text("role").notNull().default("distributor"), // distributor | admin
  referralCode: text("referral_code").notNull().unique(),
  referrerId: text("referrer_id"), // UUID referral code of sponsor
  sponsorId: integer("sponsor_id"), // FK to users(id) - direct recruiter
  packageType: text("package_type"), // starter | pro | elite
  username: text("username"),
  state: text("state"),
  city: text("city"),
  dob: text("dob"),
  gender: text("gender"),
  profilePhoto: text("profile_photo"),
  govtIdProof: text("govt_id_proof"),
  sponsorReferralId: text("sponsor_referral_id"),
  placementSide: text("placement_side"),
  usdtAddress: text("usdt_address"),
  bankDetails: text("bank_details"),
  leftBv: numeric("left_bv", { precision: 12, scale: 2 }).notNull().default("0"),
  rightBv: numeric("right_bv", { precision: 12, scale: 2 }).notNull().default("0"),
  residualLeftBv: numeric("residual_left_bv", { precision: 12, scale: 2 }).notNull().default("0"),
  residualRightBv: numeric("residual_right_bv", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
