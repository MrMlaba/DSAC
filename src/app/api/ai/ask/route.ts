import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { askTheData } from "@/lib/ai/ask-the-data";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkOrigin } from "@/lib/origin-check";

// Real Claude calls cost money per request — bound how often one user can trigger them.
const ASK_LIMIT = 15;
const ASK_WINDOW_SECONDS = 60;

export async function POST(request: NextRequest) {
  const originError = checkOrigin(request);
  if (originError) return originError;

  const user = await requireUser();

  const { allowed, retryAfterSeconds } = checkRateLimit(`ask:${user.id}`, ASK_LIMIT, ASK_WINDOW_SECONDS);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many questions — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question.trim() : "";

  if (!question) {
    return NextResponse.json({ error: "A question is required." }, { status: 400 });
  }
  if (question.length > 500) {
    return NextResponse.json({ error: "Keep questions under 500 characters." }, { status: 400 });
  }

  try {
    const result = await askTheData(user, question);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to answer question.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
