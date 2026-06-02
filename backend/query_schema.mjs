import { db } from './dist/db/index.js';
import { sql } from 'drizzle-orm';

async function run() {
  try {
    const res = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users';
    `);
    console.log("DB Columns:", res.rows.map(r => r.column_name));
    
    // Also let's check Drizzle schema for users
    const drizzleCols = [
      "id", "email", "password_hash", "first_name", "last_name", "mobile_number", "address", "country_code", 
      "status", "is_paid", "is_kyc_verified", "role", "referral_code", "referrer_id", "sponsor_id", "package_type", 
      "username", "state", "city", "dob", "gender", "profile_photo", "govt_id_proof", "sponsor_referral_id", 
      "placement_side", "usdt_address", "bank_details", "left_bv", "right_bv", "residual_left_bv", "residual_right_bv", 
      "created_at", "updated_at"
    ];
    console.log("Missing in DB:", drizzleCols.filter(c => !res.rows.find(r => r.column_name === c)));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
