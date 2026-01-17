import * as fs from "fs/promises";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { pathExists, isDirectory, readFileContent } from "../utils/fs.js";
import {
  generateFingerprint,
  getProjectName,
  getGitRemoteUrl,
} from "./fingerprint.js";
import { sha256 } from "./crypto.js";

// Project marker files
const PROJECT_MARKERS = [
  ".git",
  "package.json",
  "pyproject.toml",
  "go.mod",
  "Cargo.toml",
  "composer.json",
];

// Directories to skip during scanning
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "vendor",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "__pycache__",
  ".venv",
  "venv",
  "target",
  ".cargo",
]);

// Environment file patterns - matches .env and .env.*
const ENV_PATTERNS = [/^\.env$/, /^\.env\..+$/];

export interface EnvFile {
  filename: string;
  checksum: string;
  content: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  git: string | null;
  fingerprint: string;
  fingerprintSource: "git" | "package" | "folder";
  fingerprintValue: string;
  envs: EnvFile[];
}

export interface ScanResult {
  projects: Project[];
  totalEnvFiles: number;
}

/**
 * Check if a directory is a project root
 */
async function isProjectRoot(dirPath: string): Promise<boolean> {
  for (const marker of PROJECT_MARKERS) {
    const markerPath = path.join(dirPath, marker);
    if (await pathExists(markerPath)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a filename matches env file patterns
 */
function isEnvFile(filename: string): boolean {
  return ENV_PATTERNS.some((pattern) => pattern.test(filename));
}

/**
 * Find all env files in a project directory recursively
 */
async function findEnvFiles(projectPath: string): Promise<EnvFile[]> {
  const envFiles: EnvFile[] = [];

  async function scanDir(dirPath: string, prefix: string = ""): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        if (entry.isFile() && isEnvFile(entry.name)) {
          try {
            const content = await readFileContent(entryPath);
            const filename = prefix ? `${prefix}/${entry.name}` : entry.name;
            envFiles.push({
              filename,
              checksum: sha256(content),
              content,
            });
          } catch {
            // Skip files we can't read
          }
        } else if (
          entry.isDirectory() &&
          !SKIP_DIRS.has(entry.name) &&
          !entry.name.startsWith(".")
        ) {
          // Recursively scan subdirectories
          const newPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
          await scanDir(entryPath, newPrefix);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  await scanDir(projectPath);
  return envFiles;
}

/**
 * Scan a directory tree for projects and their env files
 */
export async function scanDirectory(rootPath: string): Promise<ScanResult> {
  const projects: Project[] = [];
  let totalEnvFiles = 0;

  async function scan(dirPath: string): Promise<void> {
    // Check if this directory is a project
    if (await isProjectRoot(dirPath)) {
      const fingerprint = await generateFingerprint(dirPath);
      const name = await getProjectName(dirPath);
      const git = await getGitRemoteUrl(dirPath);
      const envs = await findEnvFiles(dirPath);

      projects.push({
        id: uuidv4(),
        name,
        path: dirPath,
        git,
        fingerprint: fingerprint.fingerprint,
        fingerprintSource: fingerprint.source,
        fingerprintValue: fingerprint.value,
        envs,
      });

      totalEnvFiles += envs.length;

      // Don't descend into project subdirectories looking for nested projects
      // This is a design decision - we treat each project as atomic
      return;
    }

    // Scan subdirectories
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          !SKIP_DIRS.has(entry.name) &&
          !entry.name.startsWith(".")
        ) {
          const subPath = path.join(dirPath, entry.name);
          await scan(subPath);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  // Start scanning from root
  // First check if root itself is a project
  if (await isProjectRoot(rootPath)) {
    const fingerprint = await generateFingerprint(rootPath);
    const name = await getProjectName(rootPath);
    const git = await getGitRemoteUrl(rootPath);
    const envs = await findEnvFiles(rootPath);

    projects.push({
      id: uuidv4(),
      name,
      path: rootPath,
      git,
      fingerprint: fingerprint.fingerprint,
      fingerprintSource: fingerprint.source,
      fingerprintValue: fingerprint.value,
      envs,
    });

    totalEnvFiles += envs.length;
  } else {
    // Scan subdirectories
    try {
      const entries = await fs.readdir(rootPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
          const subPath = path.join(rootPath, entry.name);
          await scan(subPath);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  return { projects, totalEnvFiles };
}

/**
 * Build fingerprint map from scanned projects
 */
export function buildFingerprintMap(projects: Project[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const project of projects) {
    map.set(project.fingerprint, project.path);
  }
  return map;
}
