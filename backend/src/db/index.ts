import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Supabase transaction mode (port 6543) releases connections after each query,
// so a pool of 5 handles high concurrency without hitting Supabase session limits.
const isProduction = process.env.NODE_ENV === "production" || 
  (process.env.DATABASE_URL && process.env.DATABASE_URL.includes("supabase.co")) || 
  (process.env.DATABASE_URL && process.env.DATABASE_URL.includes("render.com"));

const maxConnections = process.env.DATABASE_POOL_SIZE 
  ? parseInt(process.env.DATABASE_POOL_SIZE, 10) 
  : isProduction ? 5 : 10;

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: maxConnections,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ...(isProduction ? { ssl: { rejectUnauthorized: false } } : {})
});

// Prevent unhandled errors from crashing the server
pool.on("error", (err) => {
  console.error("Unexpected pg pool error:", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";

