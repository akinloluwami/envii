#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { backupCommand } from "./commands/backup.js";
import { restoreCommand } from "./commands/restore.js";
import { listCommand } from "./commands/list.js";

const program = new Command();

program
  .name("envii")
  .description(
    "Backup and restore .env files across machines with recovery-phrase authentication",
  )
  .version("0.0.2");

program
  .command("init")
  .description("Initialize Envii for the current user")
  .option("--dev", "Use local API endpoint (http://localhost:4400)")
  .action(initCommand);

program
  .command("backup")
  .description("Backup all .env files in the current directory tree")
  .option("--dev", "Use local API endpoint (http://localhost:4400)")
  .action(backupCommand);

program
  .command("restore")
  .description("Restore all .env files to their projects")
  .option("--dev", "Use local API endpoint (http://localhost:4400)")
  .option("--force", "Overwrite existing .env files")
  .action(restoreCommand);

program
  .command("list")
  .description("List all backed up projects")
  .option("--dev", "Use local API endpoint (http://localhost:4400)")
  .action(listCommand);

program.parse();
