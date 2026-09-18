import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { analyzeDocumentVersion } from "@/lib/ai/document-assist";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkOrigin } from "@/lib/origin-check";

const ANALYZE_LIMIT = 15;
const ANALYZE_WINDOW_SECONDS = 60;

export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const originError = checkOrigin(request);
  if (originError) return originError;

  const user = await requireUser();

  const { allowed, retryAfterSeconds } = checkRateLimit(`analyze:${user.id}`, ANALYZE_LIMIT, ANALYZE_WINDOW_SECONDS);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many analysis requests — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const { versionId } = await params;

  try {
    const result = await analyzeDocumentVersion(user, versionId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Forbidden") ? 403 : 500 });
  }
}
