import { db } from "./src/db/index.js";
import { usersTable } from "./src/db/schema/users.js";

async function main() {
  const admins = await db.select().from(usersTable);
  const adminUsers = admins.filter(u => u.role === 'admin');
  console.log("Admin Users:", adminUsers.map(u => ({ id: u.id, email: u.email, role: u.role, password: u.passwordHash?.substring(0, 10) + "..." })));
  process.exit(0);
}

main().catch(console.error);
