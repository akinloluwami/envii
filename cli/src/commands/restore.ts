import * as path from "path";
import chalk from "chalk";
import { loadConfig } from "../core/config.js";
import { createApiClient } from "../core/api.js";
import {
  scanDirectory,
  buildFingerprintMap,
  Project,
} from "../core/scanner.js";
import {
  deriveKey,
  decryptBackup,
  extractSaltFromBackup,
} from "../core/crypto.js";
import { logger } from "../utils/logger.js";
import { pathExists, writeFileContent } from "../utils/fs.js";
import { inputRecoveryPhrase } from "../utils/prompts.js";

interface RestoreOptions {
  dev?: boolean;
  force?: boolean;
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

interface RestoreStats {
  restored: number;
  skipped: number;
  failed: number;
}

export async function restoreCommand(options: RestoreOptions): Promise<void> {
  // Load config
  const config = await loadConfig();
  if (!config) {
    logger.error("Envii is not initialized. Run `envii init` first.");
    process.exit(1);
  }

  logger.header("Envii Restore");

  // Get recovery phrase for decryption
  logger.info("Enter your recovery phrase to decrypt the backup:\n");
  const phrase = await inputRecoveryPhrase();

  // Download latest backup first (we need to extract the salt from it)
  const downloadSpinner = logger.spinner("Downloading latest backup...");

  try {
    const api = createApiClient(config, options.dev);
    const backup = await api.getLatestBackup();

    if (!backup) {
      downloadSpinner.fail("No backups found");
      logger.newline();
      logger.info("Run `envii backup` first to create a backup.");
      process.exit(1);
    }

    downloadSpinner.succeed(
      `Downloaded backup from ${new Date(backup.createdAt).toLocaleString()}`,
    );

    // Extract salt from backup and derive key
    const keySpinner = logger.spinner("Deriving encryption key...");
    const salt = extractSaltFromBackup(backup.blob);
    const key = await deriveKey(phrase, salt);
    keySpinner.succeed("Encryption key derived");

    // Decrypt
    const decryptSpinner = logger.spinner("Decrypting...");
    let blob: BackupBlob;

    try {
      const decrypted = await decryptBackup(backup.blob, key);
      blob = JSON.parse(decrypted) as BackupBlob;
      decryptSpinner.succeed("Decrypted successfully");
    } catch (error) {
      decryptSpinner.fail("Decryption failed");
      logger.newline();
      logger.error("Could not decrypt the backup. Wrong recovery phrase?");
      process.exit(1);
    }

    // Show backup info
    logger.newline();
    logger.log(`Found ${chalk.bold(blob.projects.length)} projects in backup:`);
    for (const project of blob.projects) {
      logger.dim(`  - ${project.name}`);
    }

    // Scan local machine for projects
    logger.newline();
    const scanSpinner = logger.spinner("Scanning local machine...");
    const cwd = process.cwd();
    const { projects: localProjects } = await scanDirectory(cwd);
    const fingerprintMap = buildFingerprintMap(localProjects);

    // Match projects
    const matched: Array<{
      backupProject: BackupBlob["projects"][0];
      localPath: string;
    }> = [];
    const unmatched: BackupBlob["projects"] = [];

    for (const project of blob.projects) {
      const localPath = fingerprintMap.get(project.fingerprint);
      if (localPath) {
        matched.push({ backupProject: project, localPath });
      } else {
        unmatched.push(project);
      }
    }

    scanSpinner.succeed(
      `Found ${matched.length} matching project${matched.length === 1 ? "" : "s"}`,
    );

    // Show matched projects
    if (matched.length > 0) {
      logger.newline();
      for (const { backupProject, localPath } of matched) {
        logger.success(`${backupProject.name} → ${localPath}`);
      }
    }

    if (matched.length === 0) {
      logger.newline();
      logger.warn("No matching projects found locally.");
      logger.info(
        "Make sure you have cloned/created the projects before restoring.",
      );

      if (unmatched.length > 0) {
        logger.newline();
        logger.log("Projects not found locally:");
        for (const project of unmatched) {
          const envCount = project.envs.length;
          const envText =
            envCount === 1 ? "1 env file" : `${envCount} env files`;
          logger.dim(`  - ${project.name} (${envText})`);
        }
      }

      return;
    }

    // Restore files
    logger.newline();
    logger.log("Restoring environment files...");
    logger.newline();

    const stats: RestoreStats = { restored: 0, skipped: 0, failed: 0 };

    for (const { backupProject, localPath } of matched) {
      for (const envFile of backupProject.envs) {
        const filePath = path.join(localPath, envFile.filename);
        const relativePath = `${backupProject.name}/${envFile.filename}`;

        try {
          const exists = await pathExists(filePath);

          if (exists && !options.force) {
            logger.restoreItem(relativePath, "skipped");
            stats.skipped++;
          } else {
            await writeFileContent(filePath, envFile.content, 0o600);
            logger.restoreItem(relativePath, "restored");
            stats.restored++;
          }
        } catch (error) {
          logger.restoreItem(relativePath, "failed");
          stats.failed++;
        }
      }
    }

    // Summary
    const total = stats.restored + stats.skipped + stats.failed;
    logger.newline();
    logger.log(
      `Restored ${chalk.green(stats.restored)} of ${total} files` +
        (stats.skipped > 0 ? chalk.dim(` (${stats.skipped} skipped)`) : "") +
        (stats.failed > 0 ? chalk.red(` (${stats.failed} failed)`) : ""),
    );

    // Show unmatched projects
    if (unmatched.length > 0) {
      logger.newline();
      logger.log("Projects not found locally:");
      for (const project of unmatched) {
        const envCount = project.envs.length;
        const envText = envCount === 1 ? "1 env file" : `${envCount} env files`;
        logger.dim(`  - ${project.name} (${envText})`);
      }
    }

    // Help text
    if (stats.skipped > 0) {
      logger.newline();
      logger.info("Use --force to overwrite existing files.");
    }

    if (options.dev) {
      logger.newline();
      logger.dim("(Using local development API)");
    }
  } catch (error) {
    downloadSpinner.fail("Restore failed");
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
