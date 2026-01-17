import { Hono } from "hono";
import { Context, Next } from "hono";
import {
  getAnalyticsSummary,
  getEvents,
  getEventCountsByType,
  EventType,
} from "../db/schema.js";

/**
 * Admin authentication middleware
 * Requires ADMIN_API_KEY environment variable to be set
 * Format: Bearer <admin_api_key>
 */
export async function adminAuthMiddleware(c: Context, next: Next) {
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    return c.json({ error: "Admin API not configured" }, 503);
  }

  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    return c.json(
      { error: "Unauthorized", message: "Missing Authorization header" },
      401,
    );
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer" || parts[1] !== adminKey) {
    return c.json(
      { error: "Unauthorized", message: "Invalid admin API key" },
      401,
    );
  }

  await next();
}

const admin = new Hono();

// All admin routes require admin authentication
admin.use("/*", adminAuthMiddleware);

/**
 * GET /admin/analytics
 * Get analytics summary
 */
admin.get("/analytics", async (c) => {
  try {
    const summary = await getAnalyticsSummary();
    const eventCounts = await getEventCountsByType(7);

    return c.json({
      summary,
      eventCountsByType: eventCounts,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /admin/events
 * List events with optional filtering
 */
admin.get("/events", async (c) => {
  try {
    const eventType = c.req.query("type") as EventType | undefined;
    const vaultId = c.req.query("vaultId");
    const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
    const offset = parseInt(c.req.query("offset") || "0");

    const result = await getEvents({ eventType, vaultId, limit, offset });

    return c.json(result);
  } catch (error) {
    console.error("Error fetching events:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { admin };
