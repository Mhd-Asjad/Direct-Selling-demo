import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { usersTable } from "./dist/db/schema/index.js";
import { eq } from "drizzle-orm";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL.replace('5432', '6543') + '?pgbouncer=true', max: 5 });
const db = drizzle(pool);

async function run() {
  try {
    const res = await db.select().from(usersTable).where(eq(usersTable.email, "admin@netpro.com"));
    console.log("SUCCESS:", res);
  } catch (e) {
    console.log("ERR:", e);
  }
  process.exit(0);
}
run();
