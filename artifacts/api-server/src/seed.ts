import { db, usersTable, networkNodesTable, walletsTable, activityFeedTable } from "@workspace/db";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "admin@netpro.com"));

  if (existing) {
    console.log("Admin already exists — skipping seed.");
    process.exit(0);
  }

  const adminHash = await bcrypt.hash("admin123", 10);
  const [admin] = await db
    .insert(usersTable)
    .values({
      email: "admin@netpro.com",
      passwordHash: adminHash,
      firstName: "Admin",
      lastName: "NetPro",
      mobileNumber: "+1-555-0001",
      address: "100 HQ Boulevard, Network City",
      countryCode: "US",
      status: "active",
      role: "admin",
      referralCode: "ADMIN001",
      packageType: "elite",
    })
    .returning();

  console.log("Created admin:", admin.email);

  await db.insert(walletsTable).values({
    userId: admin.id,
    totalEarned: "500",
    totalSpent: "50",
    availableBalance: "450",
  });

  const [adminNode] = await db
    .insert(networkNodesTable)
    .values({ userId: admin.id, parentId: null, sponsorId: null, leg: null, depth: 0 })
    .returning();

  const hash = await bcrypt.hash("demo123", 10);
  const demoUsers = [
    { email: "alice@demo.com", first: "Alice", last: "Johnson", pkg: "pro", code: "ALICE001" },
    { email: "bob@demo.com", first: "Bob", last: "Smith", pkg: "starter", code: "BOB00001" },
    { email: "carol@demo.com", first: "Carol", last: "Davis", pkg: "elite", code: "CAROL001" },
    { email: "david@demo.com", first: "David", last: "Wilson", pkg: "pro", code: "DAVID001" },
    { email: "eve@demo.com", first: "Eve", last: "Martinez", pkg: "starter", code: "EVE00001" },
    { email: "frank@demo.com", first: "Frank", last: "Brown", pkg: "pro", code: "FRANK001" },
  ];

  const created = [];
  for (let i = 0; i < demoUsers.length; i++) {
    const u = demoUsers[i];
    const [newUser] = await db.insert(usersTable).values({
      email: u.email, passwordHash: hash, firstName: u.first, lastName: u.last,
      mobileNumber: `+1-555-${1000 + i}`, address: `${i + 1} Demo Street`, countryCode: "US",
      status: "active", role: "distributor", referralCode: u.code,
      referrerId: "ADMIN001", sponsorId: admin.id, packageType: u.pkg,
    }).returning();
    await db.insert(walletsTable).values({
      userId: newUser.id, totalEarned: String((i + 1) * 25), totalSpent: "0", availableBalance: String((i + 1) * 25),
    });
    created.push(newUser);
    console.log("Created:", newUser.email);
  }

  const [aliceNode] = await db.insert(networkNodesTable).values({
    userId: created[0].id, parentId: adminNode.id, sponsorId: admin.id, leg: "left", depth: 1, leftBv: "90", rightBv: "60",
  }).returning();
  const [bobNode] = await db.insert(networkNodesTable).values({
    userId: created[1].id, parentId: adminNode.id, sponsorId: admin.id, leg: "right", depth: 1, leftBv: "30", rightBv: "30",
  }).returning();
  await db.update(networkNodesTable).set({ leftChildId: aliceNode.id, rightChildId: bobNode.id, leftBv: "180", rightBv: "120" }).where(eq(networkNodesTable.id, adminNode.id));

  const [carolNode] = await db.insert(networkNodesTable).values({
    userId: created[2].id, parentId: aliceNode.id, sponsorId: admin.id, leg: "left", depth: 2,
  }).returning();
  const [davidNode] = await db.insert(networkNodesTable).values({
    userId: created[3].id, parentId: aliceNode.id, sponsorId: admin.id, leg: "right", depth: 2,
  }).returning();
  await db.update(networkNodesTable).set({ leftChildId: carolNode.id, rightChildId: davidNode.id }).where(eq(networkNodesTable.id, aliceNode.id));

  const [eveNode] = await db.insert(networkNodesTable).values({
    userId: created[4].id, parentId: bobNode.id, sponsorId: admin.id, leg: "left", depth: 2,
  }).returning();
  const [frankNode] = await db.insert(networkNodesTable).values({
    userId: created[5].id, parentId: bobNode.id, sponsorId: admin.id, leg: "right", depth: 2,
  }).returning();
  await db.update(networkNodesTable).set({ leftChildId: eveNode.id, rightChildId: frankNode.id }).where(eq(networkNodesTable.id, bobNode.id));

  await db.insert(activityFeedTable).values([
    { userId: admin.id, type: "registration", message: "Admin account initialized", amount: null },
    { userId: admin.id, type: "commission_earned", message: "Earned $25.00 direct referral commission", amount: "25.00", relatedUserId: created[0].id },
    { userId: admin.id, type: "commission_earned", message: "Earned $25.00 direct referral commission", amount: "25.00", relatedUserId: created[1].id },
    { userId: admin.id, type: "binary_match", message: "Binary match! 1 cycle completed — earned $70.00", amount: "70.00" },
  ]);
  for (const u of created) {
    await db.insert(activityFeedTable).values({ userId: u.id, type: "registration", message: "Welcome! Your account has been activated.", amount: null });
  }

  console.log("\n=== SEED COMPLETE ===");
  console.log("Admin: admin@netpro.com / admin123");
  console.log("Demo: alice@demo.com ... frank@demo.com / demo123");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
