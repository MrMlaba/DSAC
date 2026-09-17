import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { createDocumentVersion } from "@/lib/data/documents";
import type { DocumentType, Quarter } from "@prisma/client";

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const form = await request.formData();

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  const entityId = String(form.get("entityId") ?? "");
  const type = String(form.get("type") ?? "") as DocumentType;
  const title = String(form.get("title") ?? "").trim();
  const financialYearId = String(form.get("financialYearId") ?? "");
  const quarterRaw = form.get("quarter");
  const quarter = typeof quarterRaw === "string" && quarterRaw ? (quarterRaw as Quarter) : undefined;
  const changeNote = typeof form.get("changeNote") === "string" ? String(form.get("changeNote")) : undefined;
  const documentIdRaw = form.get("documentId");
  const documentId = typeof documentIdRaw === "string" && documentIdRaw ? documentIdRaw : undefined;

  if (!entityId || !type || !title || !financialYearId) {
    return NextResponse.json({ error: "entityId, type, title and financialYearId are required." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const { document, version } = await createDocumentVersion(user, {
      entityId,
      documentId,
      type,
      title,
      financialYearId,
      quarter,
      changeNote,
      file: buffer,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
    });
    return NextResponse.json({ documentId: document.id, versionId: version.id, versionNumber: version.versionNumber });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    const status = message.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
