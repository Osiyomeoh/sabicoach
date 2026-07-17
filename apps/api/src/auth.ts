import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export type AuthPayload = { email: string; password: string; displayName?: string };

export function parseAuthPayload(value: unknown): AuthPayload | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const email = typeof candidate.email === "string" ? candidate.email.trim().toLowerCase() : "";
  const password = typeof candidate.password === "string" ? candidate.password : "";
  const displayName = typeof candidate.displayName === "string" ? candidate.displayName.trim().slice(0, 80) : undefined;
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return null;
  return { email, password, displayName };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, salt, digest] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !digest) return false;
  const expected = Buffer.from(digest, "base64url");
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSessionToken(): string { return randomBytes(32).toString("base64url"); }
export function hashSessionToken(token: string): string { return createHash("sha256").update(token).digest("hex"); }
export function readCookie(header: string | undefined, name: string): string | undefined {
  return header?.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
}
