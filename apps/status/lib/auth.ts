import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { SignJWT } from "jose";
import { env } from "./env";
import { getAdminAuth } from "./settings";

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE = "sp_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (seconds)

/** Stable signing secret. MUST be set in production via SESSION_SECRET. */
function getSecretKey(): Uint8Array {
  const secret = env.SESSION_SECRET || "insecure-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

// ---------- Password hashing (scrypt) ----------
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPasswordHash(
  password: string,
  stored: string
): Promise<boolean> {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const keyBuffer = Buffer.from(key, "hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return keyBuffer.length === derived.length && timingSafeEqual(keyBuffer, derived);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** True if any admin credential exists (DB hash or env ADMIN_PASSWORD). */
export async function adminConfigured(): Promise<boolean> {
  const { passwordHash } = await getAdminAuth();
  return Boolean(passwordHash || env.ADMIN_PASSWORD);
}

/** Verify a submitted password against the DB hash, else the env password. */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  if (!password) return false;
  const { passwordHash } = await getAdminAuth();
  if (passwordHash) return verifyPasswordHash(password, passwordHash);
  if (env.ADMIN_PASSWORD) return safeEqual(password, env.ADMIN_PASSWORD);
  return false;
}

// ---------- Session ----------
export async function createSession(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
