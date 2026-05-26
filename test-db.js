import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT 1').then(() => {
  console.log("Connection successful!");
  process.exit(0);
}).catch(err => {
  console.error("Connection failed:", err);
  process.exit(1);
});
