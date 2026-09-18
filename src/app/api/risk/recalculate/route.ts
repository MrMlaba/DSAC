import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { canReviewDocuments } from "@/lib/constants";
import { recalculateAllRiskScores } from "@/lib/risk-engine";
import { checkOrigin } from "@/lib/origin-check";
import { checkRateLimit } from "@/lib/rate-limit";

const RECALCULATE_LIMIT = 5;
const RECALCULATE_WINDOW_SECONDS = 60;

/** Manual trigger — works even if the pg-boss scheduler failed to start. Same role gate as document review (DSAC staff, not read-only). */
export async function POST(request: Request) {
  const originError = checkOrigin(request);
  if (originError) return originError;

  const user = await requireUser();
  if (!canReviewDocuments(user.role)) {
    return NextResponse.json({ error: "Forbidden: this role cannot trigger a recalculation." }, { status: 403 });
  }

  const { allowed, retryAfterSeconds } = checkRateLimit(`recalculate:${user.id}`, RECALCULATE_LIMIT, RECALCULATE_WINDOW_SECONDS);
  if (!allowed) {
    return NextResponse.json(
      { error: "Please wait before recalculating again." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  try {
    const count = await recalculateAllRiskScores();
    return NextResponse.json({ entitiesRecalculated: count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recalculation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
