import "server-only";
import crypto from "crypto";

// AES-256-GCM encryption for integration secrets at rest. The key is derived
// from APP_ENCRYPTION_KEY (preferred) or AUTH_SECRET so we never store secrets
// in plaintext in the database.

function key(): Buffer {
  const base = process.env.APP_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!base || base.length < 16) {
    throw new Error("APP_ENCRYPTION_KEY (or AUTH_SECRET) must be set to encrypt integration secrets.");
  }
  // Derive a stable 32-byte key from whatever length the secret is.
  return crypto.createHash("sha256").update(base).digest();
}

/** Encrypt an object → compact base64 string (iv|tag|ciphertext). */
export function encryptJson(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

/** Decrypt a string produced by encryptJson back into its object. */
export function decryptJson<T = Record<string, unknown>>(payload: string): T {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
