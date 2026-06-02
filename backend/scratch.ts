import { Client } from "pg";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("insert into network_nodes (user_id, parent_id, sponsor_id, leg, depth) values (27, 17, 12, 'left', 3)");
    console.log("Success");
  } catch (e: any) {
    console.error("Code:", e.code);
    console.error("Detail:", e.detail);
    console.error("Message:", e.message);
  } finally {
    await client.end();
  }
}
run();
