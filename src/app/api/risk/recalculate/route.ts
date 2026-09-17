import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { canReviewDocuments } from "@/lib/constants";
import { recalculateAllRiskScores } from "@/lib/risk-engine";

/** Manual trigger — works even if the pg-boss scheduler failed to start. Same role gate as document review (DSAC staff, not read-only). */
export async function POST() {
  const user = await requireUser();
  if (!canReviewDocuments(user.role)) {
    return NextResponse.json({ error: "Forbidden: this role cannot trigger a recalculation." }, { status: 403 });
  }

  try {
    const count = await recalculateAllRiskScores();
    return NextResponse.json({ entitiesRecalculated: count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recalculation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
