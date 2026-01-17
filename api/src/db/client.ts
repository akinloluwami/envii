import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

let pool: pg.Pool | null = null;

export async function initDb(): Promise<pg.Pool> {
  if (pool) return pool;

  pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  // Test connection
  const client = await pool.connect();
  client.release();

  return pool;
}

export function getDb(): pg.Pool {
  if (!pool) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return pool;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export { DATABASE_URL };
