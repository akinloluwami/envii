import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import { createApiClient } from '../core/api.js';
import {
  deriveKey,
  decryptBackup,
  verifyRecoveryPhrase,
} from '../core/crypto.js';
import { logger } from '../utils/logger.js';
import { inputRecoveryPhrase } from '../utils/prompts.js';

interface ListOptions {
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

export async function listCommand(options: ListOptions): Promise<void> {
  // Load config
  const config = await loadConfig();
  if (!config) {
    logger.error('Envii is not initialized. Run `envii init` first.');
    process.exit(1);
  }

  logger.header('Envii Backup List');

  // Get recovery phrase for decryption
  logger.info('Enter your recovery phrase to view the backup:\n');
  const phrase = await inputRecoveryPhrase();

  const verifySpinner = logger.spinner('Verifying recovery phrase...');
  if (!verifyRecoveryPhrase(phrase, config.vaultId)) {
    verifySpinner.fail('Recovery phrase verification failed');
    logger.newline();
    logger.error('This recovery phrase does not match the configured vault.');
    process.exit(1);
  }
  verifySpinner.succeed('Recovery phrase verified');

  // Derive encryption key
  const spinner = logger.spinner('Deriving encryption key...');
  const key = await deriveKey(phrase, config.salt);
  spinner.succeed('Encryption key ready');

  // Download latest backup
  const downloadSpinner = logger.spinner('Downloading latest backup...');

  try {
    const api = createApiClient(config, options.dev);
    const backup = await api.getLatestBackup();

    if (!backup) {
      downloadSpinner.fail('No backups found');
      logger.newline();
      logger.info('Run `envii backup` first to create a backup.');
      return;
    }

    downloadSpinner.succeed('Downloaded backup');

    // Decrypt
    const decryptSpinner = logger.spinner('Decrypting...');
    let blob: BackupBlob;

    try {
      const decrypted = await decryptBackup(backup.blob, key);
      blob = JSON.parse(decrypted) as BackupBlob;
      decryptSpinner.succeed('Decrypted successfully');
    } catch (error) {
      decryptSpinner.fail('Decryption failed');
      logger.newline();
      logger.error('Could not decrypt the backup. Wrong recovery phrase?');
      process.exit(1);
    }

    // Display backup info
    logger.newline();
    logger.log(chalk.dim(`Last backup: ${new Date(backup.createdAt).toLocaleString()}`));
    logger.log(chalk.dim(`Device ID: ${backup.deviceId}`));
    logger.newline();

    logger.log(chalk.bold(`Projects (${blob.projects.length}):`));
    logger.newline();

    let totalEnvFiles = 0;

    for (const project of blob.projects) {
      totalEnvFiles += project.envs.length;

      const details: {
        fingerprint?: string;
        git?: string;
        package?: string;
        folder?: string;
        files: string[];
      } = {
        fingerprint: project.fingerprint,
        files: project.envs.map((e) => e.filename),
      };

      if (project.git) {
        details.git = project.git;
      } else {
        details.folder = project.name;
      }

      logger.projectBox(project.name, details);
      logger.newline();
    }

    logger.log(`Total: ${chalk.bold(totalEnvFiles)} environment file${totalEnvFiles === 1 ? '' : 's'}`);

    if (options.dev) {
      logger.newline();
      logger.dim('(Using local development API)');
    }
  } catch (error) {
    downloadSpinner.fail('Failed to fetch backup');
    logger.newline();

    if (error instanceof Error) {
      logger.error(error.message);

      if (error.message.includes('fetch')) {
        logger.newline();
        logger.info('Could not connect to the API server.');
        if (options.dev) {
          logger.dim('Make sure the local API is running: cd envii-api && npm run dev');
        }
      }
    }

    process.exit(1);
  }

  logger.newline();
}
