import handler from "../apps/mobile/api/auth/[action].js";

export default async function login(request: { query: Record<string, string | undefined> }, response: unknown): Promise<void> {
  request.query.action = "login";
  await handler(request as never, response as never);
}
