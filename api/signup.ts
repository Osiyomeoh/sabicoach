import handler from "../apps/mobile/api/auth/[action].js";

export default async function signup(request: { query: Record<string, string | undefined> }, response: unknown): Promise<void> {
  request.query.action = "signup";
  await handler(request as never, response as never);
}
