import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { reviewDocumentVersion } from "@/lib/data/documents";

export async function POST(request: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const user = await requireUser();
  const { versionId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action as "start_review" | "approve" | "return";
  const comment = typeof body.comment === "string" ? body.comment : undefined;

  if (!["start_review", "approve", "return"].includes(action)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  try {
    const version = await reviewDocumentVersion(user, versionId, action, comment);
    return NextResponse.json({ versionId: version.id, reviewStatus: version.reviewStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review action failed.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Forbidden") ? 403 : 400 });
  }
}
