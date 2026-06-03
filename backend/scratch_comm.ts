import { db } from "./src/db/index.js";
import { usersTable } from "./src/db/schema/users.js";
import { walletsTable } from "./src/db/schema/wallets.js";
import { commissionsTable } from "./src/db/schema/commissions.js";
import { activateUser } from "./src/lib/activation.js";
import { eq, desc } from "drizzle-orm";

async function main() {
  const [admin] = await db.select().from(usersTable).where(eq(usersTable.role, "admin"));
  
  // create dummy user
  const [newUser] = await db.insert(usersTable).values({
    email: "test_commission_" + Date.now() + "@demo.com",
    passwordHash: "xxx",
    firstName: "Test",
    lastName: "Comm",
    status: "pending",
    isPaid: true,
    sponsorId: admin.id,
    packageType: "course_package"
  }).returning();

  // activate
  await activateUser(newUser.id, 3000, 1000);

  // check commissions for admin
  const comms = await db.select().from(commissionsTable)
    .where(eq(commissionsTable.sourceUserId, newUser.id));
  
  console.log("Commissions awarded for this user:");
  console.dir(comms);
  
  process.exit(0);
}
main().catch(console.error);
