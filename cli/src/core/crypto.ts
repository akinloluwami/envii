import * as crypto from "crypto";
import { promisify } from "util";
import * as zlib from "zlib";
import * as bip39 from "bip39";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// AES-256-GCM constants
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 32; // 256 bits

// Argon2 alternative using PBKDF2 (Node.js native)
// In production, use argon2 package for better security
const PBKDF2_ITERATIONS = 600000; // OWASP 2023 recommendation for SHA-256

/**
 * Generate a new 12-word BIP-39 mnemonic phrase
 */
export function generateRecoveryPhrase(): string {
  return bip39.generateMnemonic(128); // 128 bits = 12 words
}

/**
 * Validate a BIP-39 mnemonic phrase
 */
export function validateRecoveryPhrase(phrase: string): boolean {
  const words = phrase.trim().split(/\s+/);
  if (words.length !== 12) {
    return false;
  }
  return bip39.validateMnemonic(phrase);
}

/**
 * Generate a random salt
 */
export function generateSalt(): string {
  return crypto.randomBytes(SALT_LENGTH).toString("base64");
}

/**
 * Derive encryption key from recovery phrase using PBKDF2
 */
export async function deriveKey(phrase: string, salt: string): Promise<Buffer> {
  const saltBuffer = Buffer.from(salt, "base64");
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      phrase,
      saltBuffer,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      "sha256",
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      },
    );
  });
}

/**
 * Generate vault ID from recovery phrase (SHA-256 hash)
 */
export function generateVaultId(phrase: string): string {
  return crypto.createHash("sha256").update(phrase).digest("hex");
}

/**
 * Generate SHA-256 checksum of content
 */
export function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Compress data using gzip
 */
export async function compress(data: string): Promise<Buffer> {
  return gzip(Buffer.from(data, "utf-8"));
}

/**
 * Decompress gzipped data
 */
export async function decompress(data: Buffer): Promise<string> {
  const decompressed = await gunzip(data);
  return decompressed.toString("utf-8");
}

/**
 * Encrypt data using AES-256-GCM
 * Returns: IV (12 bytes) + ciphertext + auth tag (16 bytes)
 */
export function encrypt(data: Buffer, key: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: IV + ciphertext + authTag
  return Buffer.concat([iv, encrypted, authTag]);
}

/**
 * Decrypt data using AES-256-GCM
 * Input format: IV (12 bytes) + ciphertext + auth tag (16 bytes)
 */
export function decrypt(encryptedData: Buffer, key: Buffer): Buffer {
  if (encryptedData.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted data: too short");
  }

  const iv = encryptedData.subarray(0, IV_LENGTH);
  const authTag = encryptedData.subarray(
    encryptedData.length - AUTH_TAG_LENGTH,
  );
  const ciphertext = encryptedData.subarray(
    IV_LENGTH,
    encryptedData.length - AUTH_TAG_LENGTH,
  );

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Full encryption pipeline: compress → encrypt → base64
 * Format: salt (32 bytes) + IV (12 bytes) + ciphertext + auth tag (16 bytes)
 */
export async function encryptBackup(
  data: string,
  key: Buffer,
  salt: string,
): Promise<string> {
  const compressed = await compress(data);
  const encrypted = encrypt(compressed, key);
  const saltBuffer = Buffer.from(salt, "base64");
  // Prepend salt to encrypted data
  const withSalt = Buffer.concat([saltBuffer, encrypted]);
  return withSalt.toString("base64");
}

/**
 * Extract salt from encrypted backup
 */
export function extractSaltFromBackup(encryptedBase64: string): string {
  const data = Buffer.from(encryptedBase64, "base64");
  const saltBuffer = data.subarray(0, SALT_LENGTH);
  return saltBuffer.toString("base64");
}

/**
 * Full decryption pipeline: base64 → extract salt → decrypt → decompress
 */
export async function decryptBackup(
  encryptedBase64: string,
  key: Buffer,
): Promise<string> {
  const data = Buffer.from(encryptedBase64, "base64");
  // Skip the salt (first 32 bytes)
  const encrypted = data.subarray(SALT_LENGTH);
  const decrypted = decrypt(encrypted, key);
  return decompress(decrypted);
}

/**
 * Get compressed and uncompressed sizes
 */
export async function getSizes(
  data: string,
): Promise<{ original: number; compressed: number }> {
  const original = Buffer.byteLength(data, "utf-8");
  const compressed = await compress(data);
  return {
    original,
    compressed: compressed.length,
  };
}
