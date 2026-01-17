import { initDb, closeDb, DATABASE_URL } from "./client.js";
import { initializeSchema } from "./schema.js";

async function main() {
  console.log(`Connecting to PostgreSQL database...`);
  console.log(`Database URL: ${DATABASE_URL?.replace(/:[^:@]+@/, ":****@")}`);
  await initDb();
  await initializeSchema();
  await closeDb();
  console.log("Done!");
}

main().catch(console.error);
