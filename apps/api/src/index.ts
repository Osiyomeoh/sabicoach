import "dotenv/config";
import cors from "cors";
import express from "express";
import { Pool } from "pg";
import { createSessionToken, hashPassword, hashSessionToken, parseAuthPayload, readCookie, verifyPassword } from "./auth.js";

const app = express();
app.use(cors({ origin: process.env.WEB_ORIGIN?.split(",") ?? true, credentials: true }));
app.use(express.json({ limit: "8mb" }));
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
const DEMO_STUDENT = "00000000-0000-0000-0000-000000000001";
const SESSION_COOKIE = "sabicoach_session";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type Diagnosis = { diagnosis: string; misconception: string; confidence: number; lesson: string[]; coachQuestion: string; expectedAnswer: string; topic: string; teacherSignal: string; recoverableMarks: number };
async function getDiagnosis(input: { image?: string; question?: string; attempt?: string; examType?: string }): Promise<Diagnosis> {
  if (!process.env.OPENAI_API_KEY) throw new Error("AI analysis is not configured.");
  const content: Array<Record<string, string>> = [{ type: "input_text", text: `You are SabiCoach, a warm Nigerian ${input.examType || "JAMB"} Mathematics coach. Analyse the student's work. Never give the answer first. Identify the first actionable mistake, distinguish conceptual gaps from procedural slips, then give three brief repair steps and one fresh near-transfer question. Return only valid JSON using exactly these keys: diagnosis, misconception, confidence, lesson, coachQuestion, expectedAnswer, topic, teacherSignal, recoverableMarks. Question: ${input.question || "Solve 3x − 4 = 11"}. Student attempt: ${input.attempt || "3x = 11 − 4, x = 7 ÷ 3"}` }];
  if (input.image) content.push({ type: "input_image", image_url: input.image, detail: "high" });
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5.6", input: [{ role: "user", content }] }) });
  if (!response.ok) throw new Error(`OpenAI request failed with ${response.status}`);
  const body = await response.json() as { output_text?: string };
  return JSON.parse((body.output_text || "").replace(/^```json\s*|\s*```$/g, "")) as Diagnosis;
}

app.get("/health", (_req, res) => res.json({ ok: true }));
app.post("/api/auth/signup", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Account service is not configured." });
  const payload = parseAuthPayload(req.body);
  if (!payload || !payload.displayName) return res.status(400).json({ error: "Enter your name, a valid email, and a password of at least 8 characters." });
  const existing = await pool.query("SELECT id FROM students WHERE email = $1", [payload.email]);
  if (existing.rowCount) return res.status(409).json({ error: "An account already exists for this email. Please log in." });
  const passwordHash = await hashPassword(payload.password);
  const student = await pool.query("INSERT INTO students (display_name, email, password_hash, exam_type, target_score, current_score) VALUES ($1,$2,$3,'JAMB',280,234) RETURNING id, display_name, exam_type, target_score, current_score", [payload.displayName, payload.email, passwordHash]);
  const token = createSessionToken();
  await pool.query("INSERT INTO sessions (student_id, token_hash, expires_at) VALUES ($1,$2,$3)", [student.rows[0].id, hashSessionToken(token), new Date(Date.now() + THIRTY_DAYS_MS)]);
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: THIRTY_DAYS_MS, path: "/" });
  res.status(201).json({ student: student.rows[0] });
});
app.post("/api/auth/login", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Account service is not configured." });
  const payload = parseAuthPayload(req.body);
  if (!payload) return res.status(400).json({ error: "Enter a valid email and password." });
  const result = await pool.query("SELECT id, display_name, exam_type, target_score, current_score, password_hash FROM students WHERE email = $1", [payload.email]);
  const student = result.rows[0] as undefined | { id: string; display_name: string; exam_type: string; target_score: number; current_score: number; password_hash: string | null };
  if (!student?.password_hash || !(await verifyPassword(payload.password, student.password_hash))) return res.status(401).json({ error: "Incorrect email or password." });
  const token = createSessionToken();
  await pool.query("INSERT INTO sessions (student_id, token_hash, expires_at) VALUES ($1,$2,$3)", [student.id, hashSessionToken(token), new Date(Date.now() + THIRTY_DAYS_MS)]);
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: THIRTY_DAYS_MS, path: "/" });
  res.json({ student: { id: student.id, displayName: student.display_name, examType: student.exam_type, targetScore: student.target_score, currentScore: student.current_score } });
});
app.post("/api/auth/logout", async (req, res) => {
  if (pool) { const token = readCookie(req.headers.cookie, SESSION_COOKIE); if (token) await pool.query("DELETE FROM sessions WHERE token_hash = $1", [hashSessionToken(token)]); }
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  res.status(204).end();
});
app.get("/api/auth/me", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Account service is not configured." });
  const token = readCookie(req.headers.cookie, SESSION_COOKIE);
  if (!token) return res.status(401).json({ error: "Not authenticated." });
  const result = await pool.query("SELECT s.id, s.display_name, s.exam_type, s.target_score, s.current_score FROM sessions se JOIN students s ON s.id = se.student_id WHERE se.token_hash = $1 AND se.expires_at > now()", [hashSessionToken(token)]);
  if (!result.rows[0]) return res.status(401).json({ error: "Not authenticated." });
  const student = result.rows[0];
  res.json({ student: { id: student.id, displayName: student.display_name, examType: student.exam_type, targetScore: student.target_score, currentScore: student.current_score } });
});
app.get("/api/home/:studentId", async (req, res) => {
  if (!pool) return res.json({ student: { displayName: "Amara", examType: "JAMB", targetScore: 280, currentScore: 234 }, rescue: { gap: 46, recoverableMarks: 12, mission: "Fix sign-change errors" }, mastery: [{ topic: "Linear Equations", percent: 65 }, { topic: "Indices", percent: 42 }, { topic: "Probability", percent: 12 }, { topic: "Geometry", percent: 88 }] });
  const { rows } = await pool.query("SELECT display_name, exam_type, target_score, current_score FROM students WHERE id = $1", [req.params.studentId]);
  if (!rows[0]) return res.status(404).json({ error: "Student not found" });
  const s = rows[0];
  res.json({ student: { displayName: s.display_name, examType: s.exam_type, targetScore: s.target_score, currentScore: s.current_score }, rescue: { gap: s.target_score - s.current_score, recoverableMarks: 12, mission: "Fix sign-change errors" }, mastery: [{ topic: "Linear Equations", percent: 65 }, { topic: "Indices", percent: 42 }, { topic: "Probability", percent: 12 }, { topic: "Geometry", percent: 88 }] });
});
app.post("/api/diagnose", async (req, res) => { try { res.json(await getDiagnosis(req.body)); } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Could not diagnose attempt" }); } });
app.post("/api/attempts", async (req, res) => {
  const { studentId = DEMO_STUDENT, examType = "JAMB", subject = "Mathematics", diagnosis } = req.body as { studentId?: string; examType?: string; subject?: string; diagnosis?: Diagnosis };
  if (!diagnosis) { res.status(400).json({ error: "A real analysis is required before saving an attempt." }); return; }
  if (pool) await pool.query("INSERT INTO attempts (student_id, exam_type, subject, topic, question_text, attempt_text, diagnosis) VALUES ($1,$2,$3,$4,$5,$6,$7)", [studentId, examType, subject, diagnosis.topic, req.body.question || "", req.body.attempt || "", diagnosis]);
  res.status(201).json({ saved: true });
});
app.post("/api/mastery/check", (req, res) => { const answer = String(req.body.answer || "").replace(/\s/g, "").replace(/^y=/i, ""); res.json({ correct: answer === String(req.body.expectedAnswer || "8"), message: answer === String(req.body.expectedAnswer || "8") ? "You fixed it. This skill is now stronger." : "Almost. Go back to the balancing step and try once more." }); });

app.listen(Number(process.env.PORT || 4000), "0.0.0.0", () => console.log("SabiCoach API running"));
