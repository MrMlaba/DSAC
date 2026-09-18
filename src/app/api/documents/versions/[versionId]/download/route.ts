import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { getVersionWithAccess } from "@/lib/data/documents";
import { storage } from "@/lib/storage";
import { getIpFromHeaders } from "@/lib/request-ip";

export async function GET(request: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const user = await requireUser();
  const { versionId } = await params;

  try {
    const version = await getVersionWithAccess(user, versionId, { logAs: "DOCUMENT_DOWNLOAD", ipAddress: getIpFromHeaders(request.headers) });
    const ext = version.storageKey.slice(version.storageKey.lastIndexOf("."));
    const filename = `${version.document.title.replace(/[^a-zA-Z0-9.\-_ ]/g, "_")}-v${version.versionNumber}${ext}`;
    const url = await storage.getDownloadUrl(version.storageKey, 300, { downloadFilename: filename });
    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not found.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Forbidden") ? 403 : 404 });
  }
}
