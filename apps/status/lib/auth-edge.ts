import { jwtVerify } from "jose";

/**
 * Edge-safe session verification, imported ONLY by middleware.ts.
 * Must not import sqlite3 or Node `crypto` — jose uses Web Crypto and runs in the Edge runtime.
 */
export const SESSION_COOKIE = "sp_session";

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET || "insecure-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload.role === "admin";
  } catch {
    return false;
  }
}
