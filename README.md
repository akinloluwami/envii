# Envii

Backup and restore `.env` files across machines using a cloud backend and recovery-phrase authentication.

## Features

- **End-to-end encryption** - Server never sees your secrets
- **Recovery phrase only** - No accounts, emails, or passwords
- **Cloud-first** - Access your env files from anywhere
- **Full restore** - Always restore complete project environments
- **Fingerprint matching** - Automatically match projects across machines

## Quick Start

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
cd envii

# Install CLI dependencies
cd envii-cli
npm install
npm run build
npm link

# Install API dependencies (in another terminal)
cd envii-api
npm install
```

### Start the API Server (Development)

```bash
cd envii-api
npm run dev
# Server runs on http://localhost:4400
```

### Initialize Envii

```bash
envii init --dev
```

This will:

1. Generate a 12-word recovery phrase (or accept an existing one)
2. Create `~/.envii/config.json` with your vault ID and settings
3. Set up encryption keys

> ⚠️ **IMPORTANT**: Save your recovery phrase securely. It's the ONLY way to restore your backups!

### Backup Your .env Files

```bash
cd ~/projects  # Navigate to your projects folder
envii backup --dev
```

This scans all subfolders for projects (detected by `.git`, `package.json`, etc.) and backs up all `.env*` files.

### Restore on Another Machine

```bash
# Initialize with your existing phrase
envii init --dev

# Navigate to projects folder
cd ~/projects

# Restore
envii restore --dev
```

### List Backed Up Projects

```bash
envii list --dev
```

## Commands

### `envii init`

Initialize Envii for the current user.

```bash
envii init [--dev]
```

Options:

- `--dev` - Use local API (http://localhost:4400)

### `envii backup`

Backup all .env files in the current directory tree.

```bash
envii backup [--dev]
```

Options:

- `--dev` - Use local API

### `envii restore`

Restore all .env files to their projects.

```bash
envii restore [--dev] [--force]
```

Options:

- `--dev` - Use local API
- `--force` - Overwrite existing .env files

### `envii list`

List all backed up projects.

```bash
envii list [--dev]
```

Options:

- `--dev` - Use local API

## Project Structure

```
envii/
├── envii-cli/           # CLI application
│   ├── src/
│   │   ├── commands/    # CLI commands
│   │   ├── core/        # Core modules
│   │   └── utils/       # Utility functions
│   └── package.json
├── envii-api/           # API server
│   ├── src/
│   │   ├── routes/      # API routes
│   │   ├── db/          # Database schema
│   │   └── middleware/  # Auth middleware
│   └── package.json
└── spec.md              # Full specification
```

## How It Works

### Recovery Phrase

- 12-word BIP-39 mnemonic phrase
- Used to derive encryption keys and vault ID
- Never stored locally or transmitted to server
- Lost phrase = lost access (no recovery possible)

### Project Detection

Projects are detected by the presence of:

- `.git` folder
- `package.json`
- `pyproject.toml`
- `go.mod`
- `Cargo.toml`
- `composer.json`

### Fingerprinting

Projects are matched across machines using fingerprints derived from:

1. Git remote URL (highest priority)
2. package.json name
3. Folder name (fallback)

### Encryption

- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 with 600,000 iterations
- **Compression**: gzip before encryption
- **IV**: Random 12 bytes per backup
- **Auth Tag**: 16 bytes for integrity verification

### Backup Format

```json
{
  "version": 1,
  "createdAt": "ISO-8601 timestamp",
  "deviceId": "uuid",
  "projects": [
    {
      "id": "uuid",
      "name": "project-name",
      "git": "git remote url or null",
      "fingerprint": "sha256 hash",
      "path": "/original/path",
      "envs": [
        {
          "filename": ".env",
          "checksum": "sha256 of content",
          "content": "actual content"
        }
      ]
    }
  ]
}
```

## API Endpoints

### `GET /health`

Health check endpoint.

```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

### `POST /backup`

Create a new backup.

Headers:

```
Authorization: Bearer <vault_id>
Content-Type: application/json
```

Body:

```json
{
  "blob": "base64-encoded-encrypted-data",
  "deviceId": "uuid"
}
```

### `GET /backup/latest`

Get the latest backup.

Headers:

```
Authorization: Bearer <vault_id>
```

### `GET /backups`

List all backups (metadata only).

Headers:

```
Authorization: Bearer <vault_id>
```

Query params:

- `limit` (default: 10, max: 100)
- `offset` (default: 0)

### Admin Endpoints

Admin endpoints require the `ADMIN_API_KEY` environment variable to be set.

#### `GET /admin/analytics`

Get analytics summary.

Headers:

```
Authorization: Bearer <admin_api_key>
```

Response:

```json
{
  "summary": {
    "totalVaults": 10,
    "totalBackups": 25,
    "totalEvents": 100,
    "totalStorageBytes": 1048576,
    "eventsToday": 5,
    "backupsToday": 2
  },
  "eventCountsByType": [
    { "event_type": "backup.created", "count": 50 },
    { "event_type": "backup.downloaded", "count": 50 }
  ]
}
```

#### `GET /admin/events`

List events with optional filtering.

Headers:

```
Authorization: Bearer <admin_api_key>
```

Query params:

- `type` - Filter by event type (backup.created, backup.downloaded, vault.created)
- `vaultId` - Filter by vault ID
- `limit` (default: 50, max: 100)
- `offset` (default: 0)

Response:

````json
{
  "events": [
    {
      "id": 1,
      "event_type": "backup.created",
      "vault_id": "abc123...",
      "backup_id": "bkp_xyz789",
      "metadata": { "sizeBytes": 1024 },
      "ip_address": "192.168.1.1",
      "user_agent": "node-fetch/1.0",
      "created_at": "2026-01-17T12:00:00Z"
    }
  ],
  "total": 100
}

## Security

### What's Protected

Server never sees recovery phrase
Server never sees plaintext .env contents
Server never sees encryption keys
All backups encrypted with AES-256-GCM
Each backup has unique IV
Authentication tags prevent tampering

### What's NOT Protected

Client-side malware
Recovery phrase compromise
Physical access to unlocked device

## Development

### Running Tests

```bash
# CLI tests
cd envii-cli
npm test

# API tests
cd envii-api
npm test
````

### Building for Production

```bash
# Build CLI
cd envii-cli
npm run build

# Build API
cd envii-api
npm run build
```

## Configuration

### CLI Config Location

```
~/.envii/config.json
```

### API Environment Variables

```bash
PORT=4400                    # Server port
DATABASE_URL=postgresql://...  # PostgreSQL connection string
ADMIN_API_KEY=your-secret-key  # Admin API authentication key
```

### Database Setup

Envii uses PostgreSQL for data storage. Set the `DATABASE_URL` environment variable in `api/.env`:

```bash
DATABASE_URL=postgresql://user:password@host:port/database
ADMIN_API_KEY=your-admin-secret-key
```

Initialize the database schema:

```bash
cd api
npm run db:init
```

## License

MIT
