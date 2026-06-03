import { db } from "./index.js";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import fs from "node:fs";
import { logger } from "../lib/logger.js";

export async function initDatabase() {
  try {
    // 1. Check if 'users' table exists in the public schema
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    const usersTableExists = tableCheck.rows[0]?.exists;

    let migrationsFolder = path.resolve(process.cwd(), "drizzle");
    if (!fs.existsSync(migrationsFolder)) {
      migrationsFolder = path.resolve(process.cwd(), "backend/drizzle");
    }

    if (!usersTableExists) {
      logger.info("Database is empty. Running initial migrations...");
      await migrate(db, { migrationsFolder });
      logger.info("Initial migrations completed.");
    } else {
      logger.info("Database already initialized. Ensuring all columns exist...");
      // Safely add any new columns that might have been added to the users table
      const alterQueries = [
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_kyc_verified" boolean DEFAULT false NOT NULL`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sponsor_referral_id" text`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "placement_side" text`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "usdt_address" text`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bank_details" text`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "left_bv" numeric(12, 2) DEFAULT '0' NOT NULL`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "right_bv" numeric(12, 2) DEFAULT '0' NOT NULL`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "residual_left_bv" numeric(12, 2) DEFAULT '0' NOT NULL`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "residual_right_bv" numeric(12, 2) DEFAULT '0' NOT NULL`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" text`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "state" text`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "city" text`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dob" text`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" text`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_photo" text`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "govt_id_proof" text`,
      ];

      for (const query of alterQueries) {
        try {
          await db.execute(sql.raw(query));
        } catch (err) {
          logger.error({ err, query }, "Failed to execute migration query");
        }
      }
      
      // Also ensure manual_deposit_requests table exists if they added it recently
      const depositTableCheck = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'manual_deposit_requests'
        );
      `);
      if (!depositTableCheck.rows[0]?.exists) {
        logger.info("Creating manual_deposit_requests table...");
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "manual_deposit_requests" (
            "id" serial PRIMARY KEY NOT NULL,
            "user_id" integer NOT NULL,
            "amount_in_usdt" numeric(18, 6) NOT NULL,
            "blockchain_network" text NOT NULL,
            "sender_wallet_address" text NOT NULL,
            "tx_hash" text,
            "screenshot_url" text,
            "status" text DEFAULT 'PENDING' NOT NULL,
            "reviewed_by" integer,
            "reviewed_at" timestamp with time zone,
            "rejection_reason" text,
            "coupon1_code" text,
            "coupon2_code" text,
            "created_at" timestamp with time zone DEFAULT now() NOT NULL,
            "updated_at" timestamp with time zone DEFAULT now() NOT NULL
          );
        `);
      }

      // Ensure wallets.wallet_id unique constraint exists
      try {
        const walletsTableCheck = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'wallets'
          );
        `);
        if (walletsTableCheck.rows[0]?.exists) {
          await db.execute(sql`
            ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "wallet_id" text;
          `);
          const constraintCheck = await db.execute(sql`
            SELECT 1 FROM pg_constraint WHERE conname = 'wallets_wallet_id_unique';
          `);
          if (constraintCheck.rows.length === 0) {
            await db.execute(sql`DROP INDEX IF EXISTS "wallets_wallet_id_unique";`);
            const wallets = await db.execute(sql`SELECT id, wallet_id FROM wallets`);
            for (const w of wallets.rows) {
              if (!w.wallet_id) {
                const newId = "NP-" + Math.random().toString(36).substring(2, 10).toUpperCase();
                await db.execute(sql`UPDATE wallets SET wallet_id = ${newId} WHERE id = ${w.id}`);
              }
            }
            await db.execute(sql`ALTER TABLE "wallets" ADD CONSTRAINT "wallets_wallet_id_unique" UNIQUE("wallet_id");`);
          }
        }
      } catch (err) {
        logger.error({ err }, "Failed to ensure wallets constraints");
      }

      logger.info("Column and table synchronization check complete.");
    }
  } catch (err) {
    logger.error({ err }, "Database initialization failed");
    throw err;
  }
}
