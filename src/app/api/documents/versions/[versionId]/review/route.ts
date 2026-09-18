import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { reviewDocumentVersion } from "@/lib/data/documents";
import { checkOrigin } from "@/lib/origin-check";
import { reviewDocumentSchema } from "@/lib/validation/document";

export async function POST(request: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const originError = checkOrigin(request);
  if (originError) return originError;

  const user = await requireUser();
  const { versionId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = reviewDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid action." }, { status: 400 });
  }

  try {
    const version = await reviewDocumentVersion(user, versionId, parsed.data.action, parsed.data.comment);
    return NextResponse.json({ versionId: version.id, reviewStatus: version.reviewStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review action failed.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Forbidden") ? 403 : 400 });
  }
}
