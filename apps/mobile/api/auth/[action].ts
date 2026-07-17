import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Pool } from "pg";

type Request = { method?: string; query: { action?: string }; body?: unknown; headers: { cookie?: string | string[] } };
type Response = { status: (status: number) => Response; json: (body: unknown) => void; end: () => void; setHeader: (name: string, value: string) => void };
type Student = { id: string; display_name: string; exam_type: "JAMB" | "WAEC" | "NECO"; target_score: number; current_score: number; password_hash?: string | null };
const scrypt = promisify(scryptCallback);
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : undefined;
const SESSION_COOKIE = "sabicoach_session";
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 30;
function bodyOf(value: unknown): Record<string, unknown> { if (typeof value === "string") { try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; } } return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function cookieOf(header: string | string[] | undefined): string | undefined { const value = Array.isArray(header) ? header[0] : header; return value?.split(";").map(item => item.trim()).find(item => item.startsWith(SESSION_COOKIE + "="))?.slice(SESSION_COOKIE.length + 1); }
function tokenHash(token: string): string { return createHash("sha256").update(token).digest("hex"); }
function sessionCookie(token: string): string { return SESSION_COOKIE + "=" + token + "; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=" + SESSION_AGE_SECONDS; }
async function passwordHash(password: string): Promise<string> { const salt = randomBytes(16).toString("base64url"); const digest = await scrypt(password, salt, 64) as Buffer; return "scrypt$" + salt + "$" + digest.toString("base64url"); }
async function passwordMatches(password: string, encoded: string): Promise<boolean> { const [algorithm, salt, encodedDigest] = encoded.split("$"); if (algorithm !== "scrypt" || !salt || !encodedDigest) return false; const expected = Buffer.from(encodedDigest, "base64url"); const actual = await scrypt(password, salt, expected.length) as Buffer; return expected.length === actual.length && timingSafeEqual(expected, actual); }
async function ensureSchema(): Promise<void> { if (!pool) return; await pool.query("CREATE TABLE IF NOT EXISTS students (id UUID PRIMARY KEY, display_name TEXT NOT NULL, exam_type TEXT NOT NULL DEFAULT 'JAMB', target_score INTEGER NOT NULL DEFAULT 280, current_score INTEGER NOT NULL DEFAULT 234, created_at TIMESTAMPTZ NOT NULL DEFAULT now()); ALTER TABLE students ADD COLUMN IF NOT EXISTS email TEXT; ALTER TABLE students ADD COLUMN IF NOT EXISTS password_hash TEXT; CREATE UNIQUE INDEX IF NOT EXISTS students_email_unique ON students (email) WHERE email IS NOT NULL; CREATE TABLE IF NOT EXISTS sessions (id UUID PRIMARY KEY, student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());"); }
function publicStudent(student: Student) { return { displayName: student.display_name, examType: student.exam_type, targetScore: student.target_score, currentScore: student.current_score }; }
export default async function handler(request: Request, response: Response): Promise<void> {
  if (!pool) { response.status(503).json({ error: "Account service is not configured." }); return; }
  try {
    await ensureSchema();
    const action = request.query.action;
    if (action === "signup" && request.method === "POST") {
      const body = bodyOf(request.body); const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 80) : ""; const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""; const password = typeof body.password === "string" ? body.password : "";
      if (!displayName || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) { response.status(400).json({ error: "Enter your name, a valid email, and a password of at least 8 characters." }); return; }
      const existing = await pool.query("SELECT id FROM students WHERE email = $1", [email]);
      if (existing.rowCount) { response.status(409).json({ error: "An account already exists for this email. Please log in." }); return; }
      const created = await pool.query<Student>("INSERT INTO students (id, display_name, email, password_hash) VALUES ($1,$2,$3,$4) RETURNING id, display_name, exam_type, target_score, current_score", [randomUUID(), displayName, email, await passwordHash(password)]);
      const token = randomBytes(32).toString("base64url"); await pool.query("INSERT INTO sessions (id, student_id, token_hash, expires_at) VALUES ($1,$2,$3,now() + interval '30 days')", [randomUUID(), created.rows[0].id, tokenHash(token)]);
      response.setHeader("Set-Cookie", sessionCookie(token)); response.status(201).json({ student: publicStudent(created.rows[0]) }); return;
    }
    if (action === "login" && request.method === "POST") {
      const body = bodyOf(request.body); const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""; const password = typeof body.password === "string" ? body.password : "";
      const result = await pool.query<Student>("SELECT id, display_name, exam_type, target_score, current_score, password_hash FROM students WHERE email = $1", [email]); const student = result.rows[0];
      if (!student?.password_hash || !(await passwordMatches(password, student.password_hash))) { response.status(401).json({ error: "Incorrect email or password." }); return; }
      const token = randomBytes(32).toString("base64url"); await pool.query("INSERT INTO sessions (id, student_id, token_hash, expires_at) VALUES ($1,$2,$3,now() + interval '30 days')", [randomUUID(), student.id, tokenHash(token)]);
      response.setHeader("Set-Cookie", sessionCookie(token)); response.status(200).json({ student: publicStudent(student) }); return;
    }
    response.status(404).json({ error: "Not found." });
  } catch (error) { console.error("SabiCoach account API failed", error); response.status(500).json({ error: "We could not complete this request. Please try again." }); }
}
