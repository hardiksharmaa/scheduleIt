/**
 * AES-256-GCM encryption utilities for storing OAuth tokens securely.
 *
 * The ENCRYPTION_KEY env var must be a 64-char hex string (32 bytes).
 * You can generate one with: openssl rand -hex 32
 *
 * Ciphertext format (base64 encoded): [ iv (12B) | authTag (16B) | ciphertext ]
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm" as const;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) throw new Error("ENCRYPTION_KEY env var is not set");
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
  }
  return key;
}

/**
 * Encrypts a UTF-8 plaintext string.
 * Returns a base64-encoded string: iv + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv  = crypto.randomBytes(12); // 96-bit IV recommended for GCM

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag(); // 16 bytes by default

  // Pack: iv(12) | tag(16) | ciphertext
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/**
 * Decrypts a base64-encoded string produced by `encrypt`.
 * Returns the original UTF-8 plaintext.
 */
export function decrypt(ciphertext: string): string {
  const key  = getKey();
  const data = Buffer.from(ciphertext, "base64");

  const iv        = data.subarray(0, 12);
  const tag       = data.subarray(12, 28);
  const encrypted = data.subarray(28);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
