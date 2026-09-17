import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { analyzeDocumentVersion } from "@/lib/ai/document-assist";

export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const user = await requireUser();
  const { versionId } = await params;

  try {
    const result = await analyzeDocumentVersion(user, versionId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Forbidden") ? 403 : 500 });
  }
}
