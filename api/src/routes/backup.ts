import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { authMiddleware } from "../middleware/auth.js";
import {
  createBackup,
  getLatestBackup,
  listBackups,
  logEvent,
} from "../db/schema.js";

const backup = new Hono();

// All routes require authentication
backup.use("/*", authMiddleware);

// Max backup size: 10MB
const MAX_BACKUP_SIZE = 10 * 1024 * 1024;

/**
 * POST /backup
 * Create a new backup
 */
backup.post("/", async (c) => {
  const vaultId = c.get("vaultId");

  try {
    const body = await c.req.json<{ blob: string; deviceId?: string }>();

    if (!body.blob) {
      return c.json({ error: "Missing blob field" }, 400);
    }

    // Decode base64 blob
    const blobBuffer = Buffer.from(body.blob, "base64");

    // Check size limit
    if (blobBuffer.length > MAX_BACKUP_SIZE) {
      return c.json(
        {
          error: "Payload too large",
          message: `Backup size ${blobBuffer.length} exceeds maximum of ${MAX_BACKUP_SIZE} bytes`,
        },
        413,
      );
    }

    // Generate backup ID
    const backupId = `bkp_${uuidv4().replace(/-/g, "").substring(0, 16)}`;

    // Store backup
    const record = await createBackup(
      backupId,
      vaultId,
      blobBuffer,
      body.deviceId,
    );

    // Log event
    await logEvent("backup.created", {
      vaultId,
      backupId: record.id,
      metadata: { sizeBytes: record.size_bytes, deviceId: body.deviceId },
      ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
    });

    return c.json(
      {
        id: record.id,
        vaultId: record.vault_id,
        createdAt: record.created_at,
        sizeBytes: record.size_bytes,
      },
      201,
    );
  } catch (error) {
    console.error("Error creating backup:", error);

    if (error instanceof SyntaxError) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /backup/latest
 * Get the latest backup for the authenticated vault
 */
backup.get("/latest", async (c) => {
  const vaultId = c.get("vaultId");

  try {
    const record = await getLatestBackup(vaultId);

    if (!record) {
      return c.json({ error: "No backups found" }, 404);
    }

    // Convert Uint8Array to base64
    const blobBase64 = Buffer.from(record.blob).toString("base64");

    // Log event
    await logEvent("backup.downloaded", {
      vaultId,
      backupId: record.id,
      ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
    });

    return c.json({
      id: record.id,
      blob: blobBase64,
      createdAt: record.created_at,
      deviceId: record.device_id,
    });
  } catch (error) {
    console.error("Error fetching latest backup:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { backup };

/**
 * Backups list endpoint (separate route group for /backups)
 */
const backups = new Hono();

backups.use("/*", authMiddleware);

/**
 * GET /backups
 * List all backups for the authenticated vault
 */
backups.get("/", async (c) => {
  const vaultId = c.get("vaultId");

  try {
    const limit = Math.min(parseInt(c.req.query("limit") || "10"), 100);
    const offset = parseInt(c.req.query("offset") || "0");

    const result = await listBackups(vaultId, limit, offset);

    return c.json({
      backups: result.backups.map((b) => ({
        id: b.id,
        createdAt: b.created_at,
        sizeBytes: b.size_bytes,
        deviceId: b.device_id,
      })),
      total: result.total,
    });
  } catch (error) {
    console.error("Error listing backups:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { backups };
