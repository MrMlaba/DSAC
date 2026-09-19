import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { requireUser, type CurrentUser } from "@/lib/current-user";
import { checkOrigin } from "@/lib/origin-check";
import { checkRateLimit } from "@/lib/rate-limit";
import { getIpFromHeaders } from "@/lib/request-ip";
import { SubmissionBlockedError } from "@/lib/data/reports";

const MUTATIONS_PER_MINUTE = 60;

/**
 * One wrapper for every mutating JSON endpoint: same-origin check, authentication, per-user rate
 * limit, schema validation, then the handler. Errors become 4xx JSON instead of leaking stack traces.
 * Role and tenant checks live in the data layer the handler calls, not here.
 */
export async function handleMutation<T>(
  request: Request,
  schema: ZodType<T> | null,
  run: (ctx: { user: CurrentUser; body: T; ip: string | null }) => Promise<unknown>,
) {
  const originError = checkOrigin(request);
  if (originError) return originError;

  let user: CurrentUser;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const limit = checkRateLimit(`mutate:${user.id}`, MUTATIONS_PER_MINUTE, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "You're doing that too quickly — please wait a moment." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

  let body = {} as T;
  if (schema) {
    const raw = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    body = parsed.data;
  }

  try {
    return NextResponse.json(await run({ user, body, ip: getIpFromHeaders(request.headers) }));
  } catch (error) {
    if (error instanceof SubmissionBlockedError) {
      return NextResponse.json({ error: error.message, problems: error.problems }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Forbidden") ? 403 : 400 });
  }
}
