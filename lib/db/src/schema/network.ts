import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const networkNodesTable = pgTable("network_nodes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  parentId: integer("parent_id"), // FK to network_nodes(id) — tree placement
  sponsorId: integer("sponsor_id"), // FK to users(id) — direct recruiter
  leg: text("leg"), // left | right — which leg under parent
  leftChildId: integer("left_child_id"),
  rightChildId: integer("right_child_id"),
  depth: integer("depth").notNull().default(0),
  leftBv: numeric("left_bv", { precision: 12, scale: 2 }).notNull().default("0"),
  rightBv: numeric("right_bv", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertNetworkNodeSchema = createInsertSchema(networkNodesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNetworkNode = z.infer<typeof insertNetworkNodeSchema>;
export type NetworkNode = typeof networkNodesTable.$inferSelect;
