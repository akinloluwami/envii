import chalk from "chalk";
import { loadConfig } from "../core/config.js";
import { createApiClient } from "../core/api.js";
import { scanDirectory, Project } from "../core/scanner.js";
import {
  deriveKey,
  encryptBackup,
  getSizes,
  verifyRecoveryPhrase,
} from "../core/crypto.js";
import { logger } from "../utils/logger.js";
import { formatBytes } from "../utils/fs.js";
import { inputRecoveryPhrase } from "../utils/prompts.js";

interface BackupOptions {
  dev?: boolean;
}

interface BackupBlob {
  version: number;
  createdAt: string;
  deviceId: string;
  projects: {
    id: string;
    name: string;
    git: string | null;
    fingerprint: string;
    path: string;
    envs: {
      filename: string;
      checksum: string;
      content: string;
    }[];
  }[];
}

export async function backupCommand(options: BackupOptions): Promise<void> {
  // Load config
  const config = await loadConfig();
  if (!config) {
    logger.error("Envii is not initialized. Run `envii init` first.");
    process.exit(1);
  }

  logger.header("Envii Backup");

  // Get recovery phrase for encryption
  logger.info("Enter your recovery phrase to encrypt the backup:\n");
  const phrase = await inputRecoveryPhrase();

  const verifySpinner = logger.spinner("Verifying recovery phrase...");
  if (!verifyRecoveryPhrase(phrase, config.vaultId)) {
    verifySpinner.fail("Recovery phrase verification failed");
    logger.newline();
    logger.error("This recovery phrase does not match the configured vault.");
    process.exit(1);
  }
  verifySpinner.succeed("Recovery phrase verified");

  // Derive encryption key
  const spinner = logger.spinner("Deriving encryption key...");
  const key = await deriveKey(phrase, config.salt);
  spinner.succeed("Encryption key ready");

  // Scan for projects
  const scanSpinner = logger.spinner("Scanning for projects...");
  const cwd = process.cwd();
  const { projects, totalEnvFiles } = await scanDirectory(cwd);

  if (projects.length === 0) {
    scanSpinner.fail("No projects found");
    logger.newline();
    logger.info("Make sure you're in a directory containing projects with:");
    logger.dim("  - .git folder");
    logger.dim("  - package.json");
    logger.dim("  - pyproject.toml");
    logger.dim("  - go.mod");
    logger.dim("  - Cargo.toml");
    logger.dim("  - composer.json");
    process.exit(1);
  }

  scanSpinner.succeed(
    `Found ${projects.length} project${projects.length === 1 ? "" : "s"}`,
  );
  logger.newline();

  // Display projects found
  const projectsWithEnvs = projects.filter((p) => p.envs.length > 0);
  const projectsWithoutEnvs = projects.filter((p) => p.envs.length === 0);

  for (const project of projects) {
    logger.projectItem(project.name, project.envs.length, project.git);
  }

  logger.newline();
  logger.log(
    `Total: ${chalk.bold(totalEnvFiles)} environment file${totalEnvFiles === 1 ? "" : "s"}`,
  );

  if (totalEnvFiles === 0) {
    logger.newline();
    logger.warn("No .env files found to backup.");
    logger.info("Nothing to do.");
    return;
  }

  // Build backup blob
  const blob: BackupBlob = {
    version: 1,
    createdAt: new Date().toISOString(),
    deviceId: config.deviceId,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      git: p.git,
      fingerprint: p.fingerprint,
      path: p.path,
      envs: p.envs,
    })),
  };

  const jsonData = JSON.stringify(blob);
  const { original, compressed } = await getSizes(jsonData);

  logger.log(
    `Size: ${formatBytes(original)} (compressed: ${formatBytes(compressed)})`,
  );
  logger.newline();

  // Encrypt and upload
  const encryptSpinner = logger.spinner("Encrypting and uploading...");

  try {
    const encryptedBlob = await encryptBackup(jsonData, key, config.salt);

    // Upload to API
    const api = createApiClient(config, options.dev);
    const result = await api.uploadBackup(encryptedBlob, config.deviceId);

    encryptSpinner.succeed("Backup complete");
    logger.newline();

    logger.success(`Backup ID: ${chalk.bold(result.id)}`);
    logger.dim(`Timestamp: ${new Date(result.createdAt).toLocaleString()}`);

    if (options.dev) {
      logger.newline();
      logger.dim("(Using local development API)");
    }
  } catch (error) {
    encryptSpinner.fail("Backup failed");
    logger.newline();

    if (error instanceof Error) {
      logger.error(error.message);

      if (error.message.includes("fetch")) {
        logger.newline();
        logger.info("Could not connect to the API server.");
        if (options.dev) {
          logger.dim(
            "Make sure the local API is running: cd envii-api && npm run dev",
          );
        }
      }
    }

    process.exit(1);
  }

  logger.newline();
}
