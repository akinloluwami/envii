import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { health } from "./routes/health.js";
import { backup, backups } from "./routes/backup.js";
import { admin } from "./routes/admin.js";
import { initDb } from "./db/client.js";
import { initializeSchema } from "./db/schema.js";

async function main() {
  // Initialize database
  await initDb();
  await initializeSchema();

  // Create Hono app
  const app = new Hono();

  // Middleware
  app.use("*", logger());
  app.use("*", cors());

  // Routes
  app.route("/health", health);
  app.route("/backup", backup);
  app.route("/backups", backups);
  app.route("/admin", admin);

  // Root route
  app.get("/", (c) => {
    return c.json({
      name: "Envii API",
      version: "1.0.0",
      endpoints: {
        health: "GET /health",
        backup: {
          create: "POST /backup",
          latest: "GET /backup/latest",
          list: "GET /backups",
        },
        admin: {
          analytics: "GET /admin/analytics",
          events: "GET /admin/events",
        },
      },
    });
  });

  // 404 handler
  app.notFound((c) => {
    return c.json({ error: "Not found" }, 404);
  });

  // Error handler
  app.onError((err, c) => {
    console.error("Unhandled error:", err);
    return c.json({ error: "Internal server error" }, 500);
  });

  // Start server
  const port = parseInt(process.env.PORT || "4400");

  console.log(`
╔═══════════════════════════════════════╗
║           Envii API Server            ║
╚═══════════════════════════════════════╝

🚀 Server starting on http://localhost:${port}

Endpoints:
  GET  /health         Health check
  POST /backup         Create backup
  GET  /backup/latest  Get latest backup
  GET  /backups        List all backups
`);

  serve({
    fetch: app.fetch,
    port,
  });
}

main().catch(console.error);
