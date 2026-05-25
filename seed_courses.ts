import { db } from "./lib/db/src/index.js";
import { coursesTable } from "./lib/db/src/schema/courses.js";

async function run() {
  await db.insert(coursesTable).values([
    { name: "starter", description: "Starter Package", price: "100", bvAmount: "100", isActive: true },
    { name: "pro", description: "Pro Package", price: "500", bvAmount: "500", isActive: true },
    { name: "elite", description: "Elite Package", price: "1000", bvAmount: "1000", isActive: true }
  ]).onConflictDoNothing();
  console.log("Courses seeded!");
  process.exit(0);
}
run();
