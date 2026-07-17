import "dotenv/config";
import cors from "cors";
import express from "express";
import { Pool } from "pg";

const app = express();
app.use(cors());
app.use(express.json({ limit: "8mb" }));
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
const DEMO_STUDENT = "00000000-0000-0000-0000-000000000001";

type Diagnosis = { diagnosis: string; misconception: string; confidence: number; lesson: string[]; coachQuestion: string; expectedAnswer: string; topic: string; teacherSignal: string; recoverableMarks: number };
const demoDiagnosis: Diagnosis = {
  diagnosis: "You understand how to collect like terms. The first wrong turn happens when −4 crosses the equals sign: it becomes +4, not −4.",
  misconception: "Sign change during transposition",
  confidence: 0.93,
  lesson: ["Begin with 3x − 4 = 11.", "Add 4 to both sides. Now 3x = 15.", "Divide both sides by 3, so x = 5."],
  coachQuestion: "Try this: 2y − 7 = 9. What is y?",
  expectedAnswer: "8",
  topic: "Linear equations",
  teacherSignal: "This is a procedural slip. A short reteach on balancing equations can fix it.",
  recoverableMarks: 12
};

async function getDiagnosis(input: { image?: string; question?: string; attempt?: string; examType?: string }): Promise<Diagnosis> {
  if (!process.env.OPENAI_API_KEY) return demoDiagnosis;
  const content: Array<Record<string, string>> = [{ type: "input_text", text: `You are SabiCoach, a warm Nigerian ${input.examType || "JAMB"} Mathematics coach. Analyse the student's work. Never give the answer first. Identify the first actionable mistake, distinguish conceptual gaps from procedural slips, then give three brief repair steps and one fresh near-transfer question. Return only valid JSON using exactly these keys: diagnosis, misconception, confidence, lesson, coachQuestion, expectedAnswer, topic, teacherSignal, recoverableMarks. Question: ${input.question || "Solve 3x − 4 = 11"}. Student attempt: ${input.attempt || "3x = 11 − 4, x = 7 ÷ 3"}` }];
  if (input.image) content.push({ type: "input_image", image_url: input.image, detail: "high" });
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5.6", input: [{ role: "user", content }] }) });
  if (!response.ok) throw new Error(`OpenAI request failed with ${response.status}`);
  const body = await response.json() as { output_text?: string };
  return JSON.parse((body.output_text || "").replace(/^```json\s*|\s*```$/g, "")) as Diagnosis;
}

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/api/home/:studentId", async (req, res) => {
  if (!pool) return res.json({ student: { displayName: "Amara", examType: "JAMB", targetScore: 280, currentScore: 234 }, rescue: { gap: 46, recoverableMarks: 12, mission: "Fix sign-change errors" }, mastery: [{ topic: "Linear Equations", percent: 65 }, { topic: "Indices", percent: 42 }, { topic: "Probability", percent: 12 }, { topic: "Geometry", percent: 88 }] });
  const { rows } = await pool.query("SELECT display_name, exam_type, target_score, current_score FROM students WHERE id = $1", [req.params.studentId]);
  if (!rows[0]) return res.status(404).json({ error: "Student not found" });
  const s = rows[0];
  res.json({ student: { displayName: s.display_name, examType: s.exam_type, targetScore: s.target_score, currentScore: s.current_score }, rescue: { gap: s.target_score - s.current_score, recoverableMarks: 12, mission: "Fix sign-change errors" }, mastery: [{ topic: "Linear Equations", percent: 65 }, { topic: "Indices", percent: 42 }, { topic: "Probability", percent: 12 }, { topic: "Geometry", percent: 88 }] });
});
app.post("/api/diagnose", async (req, res) => { try { res.json(await getDiagnosis(req.body)); } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Could not diagnose attempt" }); } });
app.post("/api/attempts", async (req, res) => {
  const { studentId = DEMO_STUDENT, examType = "JAMB", subject = "Mathematics", diagnosis = demoDiagnosis } = req.body as { studentId?: string; examType?: string; subject?: string; diagnosis?: Diagnosis };
  if (pool) await pool.query("INSERT INTO attempts (student_id, exam_type, subject, topic, question_text, attempt_text, diagnosis) VALUES ($1,$2,$3,$4,$5,$6,$7)", [studentId, examType, subject, diagnosis.topic, req.body.question || "", req.body.attempt || "", diagnosis]);
  res.status(201).json({ saved: true });
});
app.post("/api/mastery/check", (req, res) => { const answer = String(req.body.answer || "").replace(/\s/g, "").replace(/^y=/i, ""); res.json({ correct: answer === String(req.body.expectedAnswer || "8"), message: answer === String(req.body.expectedAnswer || "8") ? "You fixed it. This skill is now stronger." : "Almost. Go back to the balancing step and try once more." }); });

app.listen(Number(process.env.PORT || 4000), "0.0.0.0", () => console.log("SabiCoach API running"));
