import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { getVersionWithAccess } from "@/lib/data/documents";
import { storage } from "@/lib/storage";

/** Inline (non-attachment) signed URL — used for the browser-native PDF viewer. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const user = await requireUser();
  const { versionId } = await params;

  try {
    const version = await getVersionWithAccess(user, versionId);
    const url = await storage.getDownloadUrl(version.storageKey, 300);
    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not found.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Forbidden") ? 403 : 404 });
  }
}
