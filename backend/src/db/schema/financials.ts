import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const financialLedgerTable = pgTable("financial_ledger", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // inflow | commission_paid | expense
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull(),
  userId: integer("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const washEventsTable = pgTable("wash_events", {
  id: serial("id").primaryKey(),
  executedBy: integer("executed_by").notNull(),
  walletsReset: integer("wallets_reset").notNull().default(0),
  totalAmountWiped: numeric("total_amount_wiped", { precision: 12, scale: 2 }).notNull().default("0"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activityFeedTable = pgTable("activity_feed", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(), // registration | commission_earned | binary_match | coupon_created | coupon_redeemed | wash_reset
  message: text("message").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }),
  relatedUserId: integer("related_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFinancialLedgerSchema = createInsertSchema(financialLedgerTable).omit({ id: true, createdAt: true });
export type InsertFinancialLedger = z.infer<typeof insertFinancialLedgerSchema>;
export type FinancialLedger = typeof financialLedgerTable.$inferSelect;

export const insertWashEventSchema = createInsertSchema(washEventsTable).omit({ id: true, createdAt: true });
export type InsertWashEvent = z.infer<typeof insertWashEventSchema>;
export type WashEvent = typeof washEventsTable.$inferSelect;

export const insertActivityFeedSchema = createInsertSchema(activityFeedTable).omit({ id: true, createdAt: true });
export type InsertActivityFeed = z.infer<typeof insertActivityFeedSchema>;
export type ActivityFeed = typeof activityFeedTable.$inferSelect;
