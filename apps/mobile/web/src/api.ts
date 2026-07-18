import { DEMO_DIAGNOSIS, type Diagnosis } from "./types.js";

const API_BASE_URL = (window as Window & { __SABICOACH_API_URL__?: string }).__SABICOACH_API_URL__ ?? (window.location.hostname === "localhost" ? "http://localhost:4000" : window.location.origin);
const REQUEST_TIMEOUT_MS = 12_000;

export class ApiError extends Error {}
export type AuthStudent = { displayName: string; examType: "JAMB" | "WAEC" | "NECO"; targetScore: number; currentScore: number };

function withTimeout(signal?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  signal?.addEventListener("abort", () => controller.abort(), { once: true });
  controller.signal.addEventListener("abort", () => window.clearTimeout(timeout), { once: true });
  return controller.signal;
}

export async function diagnoseAttempt(imageDataUrl?: string): Promise<{ diagnosis: Diagnosis; source: "ai" | "demo" }> {
  if (!API_BASE_URL) return { diagnosis: DEMO_DIAGNOSIS, source: "demo" };
  try {
    const response = await fetch(`${API_BASE_URL}/api/diagnose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: withTimeout(),
      body: JSON.stringify({ image: imageDataUrl, examType: "JAMB", question: "Solve 3x − 4 = 11", attempt: "3x = 11 − 4, x = 7 ÷ 3" })
    });
    if (!response.ok) throw new Error(`Diagnosis request failed: ${response.status}`);
    return { diagnosis: await response.json() as Diagnosis, source: "ai" };
  } catch {
    return { diagnosis: DEMO_DIAGNOSIS, source: "demo" };
  }
}

export async function authenticate(mode: "signup" | "login", input: { displayName?: string; email: string; password: string }): Promise<AuthStudent> {
  if (!API_BASE_URL) throw new ApiError("The account service is not available yet. Please try again shortly.");
  const response = await fetch(`${API_BASE_URL}/api/${mode}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, signal: withTimeout(), body: JSON.stringify(input) });
  const rawBody = await response.text();
  let body: { student?: AuthStudent; error?: string; code?: string; detail?: string } = {};
  try { body = JSON.parse(rawBody) as typeof body; } catch { /* Non-JSON responses are typically platform errors. */ }
  if (!response.ok || !body.student) {
    console.error("SabiCoach authentication request failed", { status: response.status, body: rawBody.slice(0, 500) });
    const context = body.code ? ` (${body.code})` : ` (HTTP ${response.status})`;
    throw new ApiError((body.detail ?? body.error ?? "Account service request failed.") + context);
  }
  return body.student;
}
