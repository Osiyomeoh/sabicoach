type Request = { method?: string; body?: unknown };
type Response = { status: (status: number) => Response; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };

type Diagnosis = {
  diagnosis: string;
  misconception: string;
  confidence: number;
  lesson: string[];
  coachQuestion: string;
  expectedAnswer: string;
  topic: string;
  teacherSignal: string;
  recoverableMarks: number;
};

function requestBody(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; }
  }
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function cleanDiagnosis(value: unknown): Diagnosis | undefined {
  if (!value || typeof value !== "object") return undefined;
  const result = value as Partial<Diagnosis>;
  if (typeof result.diagnosis !== "string" || typeof result.misconception !== "string" || !Array.isArray(result.lesson) || typeof result.coachQuestion !== "string" || typeof result.expectedAnswer !== "string" || typeof result.topic !== "string" || typeof result.teacherSignal !== "string") return undefined;
  return {
    diagnosis: result.diagnosis,
    misconception: result.misconception,
    confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0.7)),
    lesson: result.lesson.filter((step): step is string => typeof step === "string").slice(0, 4),
    coachQuestion: result.coachQuestion,
    expectedAnswer: result.expectedAnswer,
    topic: result.topic,
    teacherSignal: result.teacherSignal,
    recoverableMarks: Math.max(1, Math.round(Number(result.recoverableMarks) || 1))
  };
}

export default async function handler(request: Request, response: Response): Promise<void> {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") { response.status(405).json({ error: "Method not allowed." }); return; }
  if (!process.env.OPENAI_API_KEY) { response.status(503).json({ error: "AI analysis is not configured yet." }); return; }

  const body = requestBody(request.body);
  const image = typeof body.image === "string" ? body.image : "";
  const examType = typeof body.examType === "string" ? body.examType : "JAMB";
  if (!image.startsWith("data:image/")) { response.status(400).json({ error: "Please upload a valid JPG or PNG image." }); return; }

  try {
    const content: Array<Record<string, string>> = [{
      type: "input_text",
      text: `You are SabiCoach, a warm, rigorous ${examType} exam coach. Read the photographed handwritten attempt. Identify the first actionable wrong step, rather than merely giving an answer. Teach the missing concept in clear Nigerian classroom English, then create one short similar practice question. Return only a JSON object with exactly these keys: diagnosis, misconception, confidence (number 0 to 1), lesson (array of 3 or 4 strings), coachQuestion, expectedAnswer, topic, teacherSignal, recoverableMarks (integer). Do not invent text you cannot read; if handwriting is unclear, say so constructively and ask the student to retake the photo.`
    }, { type: "input_image", image_url: image, detail: "high" }];
    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5.6", input: [{ role: "user", content }] })
    });
    if (!aiResponse.ok) {
      const failure = await aiResponse.text();
      console.error("OpenAI diagnosis request failed", { status: aiResponse.status, failure });
      throw new Error(`OpenAI API returned ${aiResponse.status}.`);
    }
    const aiBody = await aiResponse.json() as { output_text?: string };
    const parsed = cleanDiagnosis(JSON.parse((aiBody.output_text ?? "").replace(/^```json\s*|\s*```$/g, "")));
    if (!parsed) throw new Error("The analysis response was incomplete.");
    response.status(200).json(parsed);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown AI error.";
    console.error("SabiCoach diagnosis failed", { detail, error });
    response.status(502).json({
      error: "AI analysis could not complete.",
      code: "AI_ANALYSIS_FAILURE",
      ...(process.env.AI_DEBUG === "true" ? { detail } : {})
    });
  }
}
