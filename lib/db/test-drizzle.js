import 'dotenv/config';
import { db } from './src/index.js';
import { usersTable } from './src/schema/index.js';
import { eq } from 'drizzle-orm';

async function main() {
  try {
    console.log("DATABASE_URL:", process.env.DATABASE_URL);
    const user = await db.select().from(usersTable).where(eq(usersTable.email, 'admin@netpro.com'));
    console.log("Success:", user);
    process.exit(0);
  } catch (err) {
    console.error("Drizzle query failed:", err);
    process.exit(1);
  }
}
main();
