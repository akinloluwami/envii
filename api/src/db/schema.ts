import { getDb } from "./client.js";

export async function initializeSchema(): Promise<void> {
  const db = getDb();

  // Create vaults table
  await db.query(`
    CREATE TABLE IF NOT EXISTS vaults (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_backup_at TIMESTAMP
    )
  `);

  // Create backups table
  await db.query(`
    CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY,
      vault_id TEXT NOT NULL,
      blob BYTEA NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      device_id TEXT,
      FOREIGN KEY (vault_id) REFERENCES vaults(id)
    )
  `);

  // Create indexes
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_backups_vault_id ON backups(vault_id)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at)
  `);

  // Create events table for analytics
  await db.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      event_type TEXT NOT NULL,
      vault_id TEXT,
      backup_id TEXT,
      metadata JSONB,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // Create indexes for events
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_events_vault_id ON events(vault_id)
  `);

  console.log("✓ Database schema initialized");
}

// Vault operations
export async function createVault(id: string): Promise<void> {
  const db = getDb();
  await db.query(
    `INSERT INTO vaults (id, created_at) VALUES ($1, NOW()) ON CONFLICT (id) DO NOTHING`,
    [id],
  );
}

export async function updateVaultLastBackup(id: string): Promise<void> {
  const db = getDb();
  await db.query(`UPDATE vaults SET last_backup_at = NOW() WHERE id = $1`, [
    id,
  ]);
}

export async function getVault(
  id: string,
): Promise<
  { id: string; created_at: string; last_backup_at: string | null } | undefined
> {
  const db = getDb();
  const result = await db.query("SELECT * FROM vaults WHERE id = $1", [id]);
  if (result.rows.length > 0) {
    return result.rows[0] as {
      id: string;
      created_at: string;
      last_backup_at: string | null;
    };
  }
  return undefined;
}

// Backup operations
export interface BackupRecord {
  id: string;
  vault_id: string;
  blob: Buffer;
  size_bytes: number;
  created_at: string;
  device_id: string | null;
}

export async function createBackup(
  id: string,
  vaultId: string,
  blob: Buffer,
  deviceId?: string,
): Promise<BackupRecord> {
  const db = getDb();

  // Ensure vault exists
  await createVault(vaultId);

  // Insert backup
  await db.query(
    `INSERT INTO backups (id, vault_id, blob, size_bytes, device_id, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [id, vaultId, blob, blob.length, deviceId || null],
  );

  // Update vault last_backup_at
  await updateVaultLastBackup(vaultId);

  // Return the created backup
  return (await getBackupById(id))!;
}

export async function getBackupById(
  id: string,
): Promise<BackupRecord | undefined> {
  const db = getDb();
  const result = await db.query(
    "SELECT id, vault_id, blob, size_bytes, created_at, device_id FROM backups WHERE id = $1",
    [id],
  );
  if (result.rows.length > 0) {
    const row = result.rows[0];
    return {
      id: row.id,
      vault_id: row.vault_id,
      blob: row.blob,
      size_bytes: row.size_bytes,
      created_at: row.created_at,
      device_id: row.device_id,
    };
  }
  return undefined;
}

export async function getLatestBackup(
  vaultId: string,
): Promise<BackupRecord | undefined> {
  const db = getDb();
  const result = await db.query(
    `
    SELECT id, vault_id, blob, size_bytes, created_at, device_id FROM backups
    WHERE vault_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `,
    [vaultId],
  );
  if (result.rows.length > 0) {
    const row = result.rows[0];
    return {
      id: row.id,
      vault_id: row.vault_id,
      blob: row.blob,
      size_bytes: row.size_bytes,
      created_at: row.created_at,
      device_id: row.device_id,
    };
  }
  return undefined;
}

export interface BackupMetadata {
  id: string;
  created_at: string;
  size_bytes: number;
  device_id: string | null;
}

export async function listBackups(
  vaultId: string,
  limit = 10,
  offset = 0,
): Promise<{ backups: BackupMetadata[]; total: number }> {
  const db = getDb();

  // Get total count
  const countResult = await db.query(
    "SELECT COUNT(*) as count FROM backups WHERE vault_id = $1",
    [vaultId],
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get backups
  const result = await db.query(
    `
    SELECT id, created_at, size_bytes, device_id
    FROM backups
    WHERE vault_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `,
    [vaultId, limit, offset],
  );

  return { backups: result.rows as BackupMetadata[], total };
}

// Event types for analytics
export type EventType =
  | "backup.created"
  | "backup.downloaded"
  | "vault.created"
  | "api.request";

export interface EventRecord {
  id: number;
  event_type: EventType;
  vault_id: string | null;
  backup_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export async function logEvent(
  eventType: EventType,
  options: {
    vaultId?: string;
    backupId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  } = {},
): Promise<void> {
  const db = getDb();
  await db.query(
    `INSERT INTO events (event_type, vault_id, backup_id, metadata, ip_address, user_agent, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      eventType,
      options.vaultId || null,
      options.backupId || null,
      options.metadata ? JSON.stringify(options.metadata) : null,
      options.ipAddress || null,
      options.userAgent || null,
    ],
  );
}

export interface AnalyticsSummary {
  totalVaults: number;
  totalBackups: number;
  totalEvents: number;
  totalStorageBytes: number;
  eventsToday: number;
  backupsToday: number;
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const db = getDb();

  const [vaults, backups, events, storage, eventsToday, backupsToday] =
    await Promise.all([
      db.query("SELECT COUNT(*) as count FROM vaults"),
      db.query("SELECT COUNT(*) as count FROM backups"),
      db.query("SELECT COUNT(*) as count FROM events"),
      db.query("SELECT COALESCE(SUM(size_bytes), 0) as total FROM backups"),
      db.query(
        "SELECT COUNT(*) as count FROM events WHERE created_at >= CURRENT_DATE",
      ),
      db.query(
        "SELECT COUNT(*) as count FROM backups WHERE created_at >= CURRENT_DATE",
      ),
    ]);

  return {
    totalVaults: parseInt(vaults.rows[0].count, 10),
    totalBackups: parseInt(backups.rows[0].count, 10),
    totalEvents: parseInt(events.rows[0].count, 10),
    totalStorageBytes: parseInt(storage.rows[0].total, 10),
    eventsToday: parseInt(eventsToday.rows[0].count, 10),
    backupsToday: parseInt(backupsToday.rows[0].count, 10),
  };
}

export interface EventsQuery {
  eventType?: EventType;
  vaultId?: string;
  limit?: number;
  offset?: number;
}

export async function getEvents(
  query: EventsQuery = {},
): Promise<{ events: EventRecord[]; total: number }> {
  const db = getDb();
  const { eventType, vaultId, limit = 50, offset = 0 } = query;

  let whereClause = "";
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (eventType) {
    whereClause += ` WHERE event_type = $${paramIndex++}`;
    params.push(eventType);
  }

  if (vaultId) {
    whereClause += whereClause ? " AND" : " WHERE";
    whereClause += ` vault_id = $${paramIndex++}`;
    params.push(vaultId);
  }

  // Get total count
  const countResult = await db.query(
    `SELECT COUNT(*) as count FROM events${whereClause}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get events
  const result = await db.query(
    `SELECT id, event_type, vault_id, backup_id, metadata, ip_address, user_agent, created_at
     FROM events${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset],
  );

  return { events: result.rows as EventRecord[], total };
}

export interface EventCountByType {
  event_type: string;
  count: number;
}

export async function getEventCountsByType(
  days = 7,
): Promise<EventCountByType[]> {
  const db = getDb();
  const result = await db.query(
    `SELECT event_type, COUNT(*) as count
     FROM events
     WHERE created_at >= NOW() - INTERVAL '1 day' * $1
     GROUP BY event_type
     ORDER BY count DESC`,
    [days],
  );
  return result.rows.map((row) => ({
    event_type: row.event_type,
    count: parseInt(row.count, 10),
  }));
}
