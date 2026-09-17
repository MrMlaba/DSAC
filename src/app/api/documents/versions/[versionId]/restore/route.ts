import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { restoreDocumentVersion } from "@/lib/data/documents";

export async function POST(request: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const user = await requireUser();
  const { versionId } = await params;

  try {
    const version = await restoreDocumentVersion(user, versionId);
    return NextResponse.json({ versionId: version.id, versionNumber: version.versionNumber });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Restore failed.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Forbidden") ? 403 : 400 });
  }
}
