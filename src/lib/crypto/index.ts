import crypto from "crypto";
import fs from "fs";
import path from "path";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits — NIST SP 800-38D recommended length for GCM
const LEGACY_IV_LENGTH = 16; // Previous IV length, kept for backward compatibility
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

// Environment variable for encryption key (production)
// Format: 64 hex characters (32 bytes)
const ENCRYPTION_KEY_ENV = process.env.ENCRYPTION_KEY;

const KEY_DIR = path.join(process.cwd(), ".ohmydashboard");
const KEY_PATH = path.join(KEY_DIR, ".encryption_key");

/**
 * Get or create the encryption key.
 *
 * Priority:
 * 1. keyOverride (for testing)
 * 2. ENCRYPTION_KEY environment variable (production on Vercel)
 * 3. File-based key in .ohmydashboard/.encryption_key (local development)
 *
 * For production (Vercel), set ENCRYPTION_KEY environment variable to a 64-character
 * hex string (32 bytes). You can generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
export function getEncryptionKey(keyOverride?: Buffer): Buffer {
  if (keyOverride) return keyOverride;

  // Priority 1: Environment variable (for Vercel/production)
  if (ENCRYPTION_KEY_ENV) {
    const key = Buffer.from(ENCRYPTION_KEY_ENV, "hex");
    if (key.length !== KEY_LENGTH) {
      throw new Error(
        `ENCRYPTION_KEY environment variable must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes). ` +
        `Current length: ${key.length}`
      );
    }
    return key;
  }

  // Priority 2: File-based key (local development only)
  // In production (Vercel), this will fail because the filesystem is read-only
  if (!fs.existsSync(KEY_DIR)) {
    try {
      fs.mkdirSync(KEY_DIR, { recursive: true });
    } catch {
      // Directory creation failed - likely running in a read-only filesystem (Vercel)
      // Fall back to generating a temporary key (won't persist across requests)
      console.warn(
        "[CRYPTO] Unable to create .ohmydashboard directory. " +
        "For production, set ENCRYPTION_KEY environment variable. " +
        "Using temporary key - credentials will not persist across serverless function invocations!"
      );
      return crypto.randomBytes(KEY_LENGTH);
    }
  }

  // Try to read an existing key first
  if (fs.existsSync(KEY_PATH)) {
    const stored = fs.readFileSync(KEY_PATH);
    if (stored.length === KEY_LENGTH) return stored;

    // Key file exists but has wrong length — this indicates corruption.
    // Throw rather than silently regenerating, which would permanently
    // destroy access to all previously encrypted credentials.
    throw new Error(
      `Encryption key file is corrupted (expected ${KEY_LENGTH} bytes, got ${stored.length}). ` +
      `Restore .ohmydashboard/.encryption_key from backup or delete it to start fresh (existing credentials will be lost).`
    );
  }

  // Generate a new key using exclusive-create to prevent TOCTOU race.
  // If two processes race here, the second writeFileSync will throw EEXIST
  // instead of silently overwriting the first process's key.
  const key = crypto.randomBytes(KEY_LENGTH);
  try {
    fs.writeFileSync(KEY_PATH, key, { flag: "wx", mode: 0o600 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "EEXIST") {
      // Another process created the file between our existsSync and writeFileSync.
      // Read the key they wrote instead.
      const stored = fs.readFileSync(KEY_PATH);
      if (stored.length === KEY_LENGTH) return stored;
      throw new Error("Encryption key file created by concurrent process has invalid length");
    }
    // If we can't write the file (e.g., read-only filesystem), generate a temporary key
    console.warn(
      "[CRYPTO] Unable to write encryption key file. " +
      "For production, set ENCRYPTION_KEY environment variable. " +
      "Using temporary key - credentials will not persist across serverless function invocations!"
    );
    return key;
  }
  return key;
}

/**
 * Encrypt a plaintext string.
 *
 * Returns a hex-encoded string in the format: iv:authTag:ciphertext
 * All three components are hex-encoded.
 */
export function encrypt(plaintext: string, keyOverride?: Buffer): string {
  const key = getEncryptionKey(keyOverride);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt an encrypted string.
 *
 * Expects the format produced by `encrypt()`: iv:authTag:ciphertext
 */
export function decrypt(encryptedData: string, keyOverride?: Buffer): string {
  const key = getEncryptionKey(keyOverride);

  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const ciphertext = parts[2];

  // Accept both current (12-byte) and legacy (16-byte) IV lengths
  // so that data encrypted before the IV length change can still be decrypted.
  if (iv.length !== IV_LENGTH && iv.length !== LEGACY_IV_LENGTH) {
    throw new Error("Invalid IV length");
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid auth tag length");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Check if a string looks like it was encrypted by our encrypt() function.
 * Uses format detection (hex:hex:hex with correct lengths).
 */
export function isEncrypted(data: string): boolean {
  const parts = data.split(":");
  if (parts.length !== 3) return false;

  // IV should be 24 hex chars (12 bytes) or 32 hex chars (16 bytes, legacy)
  // Auth tag is always 32 hex chars (16 bytes)
  if (parts[0].length !== IV_LENGTH * 2 && parts[0].length !== LEGACY_IV_LENGTH * 2) return false;
  if (parts[1].length !== AUTH_TAG_LENGTH * 2) return false;

  // All parts should be valid hex
  return /^[0-9a-f]+$/.test(parts[0] + parts[1] + parts[2]);
}
