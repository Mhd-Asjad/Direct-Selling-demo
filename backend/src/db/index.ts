import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isProduction = process.env.NODE_ENV === "production" || 
  (process.env.DATABASE_URL && process.env.DATABASE_URL.includes("supabase.co")) || 
  (process.env.DATABASE_URL && process.env.DATABASE_URL.includes("render.com"));

const maxConnections = process.env.DATABASE_POOL_SIZE 
  ? parseInt(process.env.DATABASE_POOL_SIZE, 10) 
  : 2;

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: maxConnections,
  ...(isProduction ? { ssl: { rejectUnauthorized: false } } : {})
});
export const db = drizzle(pool, { schema });

export * from "./schema";
