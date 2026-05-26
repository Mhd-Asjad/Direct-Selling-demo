import { db, usersTable } from '@workspace/db';
import { eq } from 'drizzle-orm';

async function main() {
  console.log("DB URL:", process.env.DATABASE_URL);
  try {
    const user = await db.select().from(usersTable).where(eq(usersTable.email, 'admin@netpro.com'));
    console.log(user);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}
main();
