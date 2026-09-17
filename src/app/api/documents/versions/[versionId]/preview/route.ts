import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { getVersionWithAccess } from "@/lib/data/documents";
import { storage } from "@/lib/storage";

/**
 * Inline preview. PDFs are previewed client-side via a signed URL in an
 * <iframe> (browsers render PDFs natively), so this route only needs to
 * serve text content — the one format we can safely render as plain text
 * without a document-rendering library. DOCX/XLSX/etc. are download-only
 * for now.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const user = await requireUser();
  const { versionId } = await params;

  try {
    const version = await getVersionWithAccess(user, versionId);
    if (version.mimeType !== "text/plain" && version.mimeType !== "text/csv") {
      return NextResponse.json({ error: "Inline preview is only available for text files." }, { status: 415 });
    }
    const buffer = await storage.getObject(version.storageKey);
    return new NextResponse(buffer.toString("utf-8"), {
      headers: { "Content-Type": `${version.mimeType}; charset=utf-8`, "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not found.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Forbidden") ? 403 : 404 });
  }
}
