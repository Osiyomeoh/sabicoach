import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = process.env.PORT || 3000;
const publicDir = join(process.cwd(), "public");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function demoDiagnosis() {
  return {
    source: "demo",
    diagnosis: "You know how to collect like terms. The error is in transposition: when −4 crosses the equals sign, it becomes +4.",
    misconception: "Sign change during transposition",
    confidence: 0.93,
    lesson: ["Start with 3x − 4 = 11.", "Add 4 to both sides, so 3x = 15.", "Now divide both sides by 3: x = 5."],
    coachQuestion: "Try this one without a calculator: 2y − 7 = 9. What is y?",
    topic: "Algebraic expressions and equations",
    teacherSignal: "This is a procedural slip, not a concept gap. A 6-minute mini-lesson on balancing equations should help the group."
  };
}

async function diagnose(body) {
  if (!process.env.OPENAI_API_KEY) return demoDiagnosis();
  const question = body.question || "A JAMB Mathematics equation question";
  const attempt = body.attempt || "Student uploaded a handwritten attempt.";
  const prompt = `You are SabiCoach, a warm Nigerian JAMB Mathematics learning coach. Analyse the student's work. Never simply give the answer first. Identify the smallest actionable misconception, distinguish concept gaps from procedural slips, then teach using short numbered steps. Create one fresh near-transfer question. Return ONLY valid JSON with keys diagnosis, misconception, confidence (0-1), lesson (array of 3 short strings), coachQuestion, topic, teacherSignal.\n\nQuestion: ${question}\nStudent's attempt: ${attempt}`;
  const content = [{ type: "input_text", text: prompt }];
  if (body.image) content.push({ type: "input_image", image_url: body.image, detail: "high" });
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5.6", input: [{ role: "user", content }] })
  });
  if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
  const result = await response.json();
  const text = result.output_text || result.output?.flatMap(item => item.content || []).find(c => c.type === "output_text")?.text;
  return JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/diagnose") {
    let raw = "";
    req.on("data", chunk => { raw += chunk; if (raw.length > 8_000_000) req.destroy(); });
    req.on("end", async () => {
      try { json(res, 200, await diagnose(JSON.parse(raw))); }
      catch (error) { json(res, 500, { error: error.message || "Could not analyse this attempt." }); }
    });
    return;
  }
  const path = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const file = normalize(join(publicDir, path));
  if (!file.startsWith(publicDir)) return json(res, 403, { error: "Forbidden" });
  try {
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404); res.end("Not found"); }
});

server.listen(port, "127.0.0.1", () => console.log(`SabiCoach is ready at http://localhost:${port}`));
