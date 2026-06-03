import { db } from "./src/db/index.js";
import { coursesTable } from "./src/db/schema/courses.js";

async function main() {
  const courses = await db.select().from(coursesTable);
  console.log(courses);
  process.exit(0);
}
main().catch(console.error);
