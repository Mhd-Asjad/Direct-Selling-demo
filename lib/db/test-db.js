import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT * FROM users LIMIT 1').then((res) => {
  console.log("Query successful! Rows:", res.rows.length);
  process.exit(0);
}).catch(err => {
  console.error("Query failed:", err);
  process.exit(1);
});
