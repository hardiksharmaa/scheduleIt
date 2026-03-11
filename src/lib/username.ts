import crypto from "crypto";
import { db } from "./db";

/**
 * Generate a unique username slug like "user-a7x3k9".
 * Retries with fresh random chars if a collision is found.
 */
export async function generateUniqueUsername(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = crypto.randomBytes(4).toString("hex").slice(0, 6);
    const candidate = `user-${suffix}`;

    const taken = await db.user.findUnique({ where: { username: candidate } });
    if (!taken) return candidate;
  }

  // Fallback: use full 12-char hex to virtually guarantee uniqueness
  const fallback = `user-${crypto.randomBytes(6).toString("hex")}`;
  return fallback;
}
