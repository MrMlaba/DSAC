import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { createDocumentVersion } from "@/lib/data/documents";
import { checkOrigin } from "@/lib/origin-check";
import { uploadDocumentMetadataSchema } from "@/lib/validation/document";

export async function POST(request: NextRequest) {
  const originError = checkOrigin(request);
  if (originError) return originError;

  const user = await requireUser();
  const form = await request.formData();

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  const parsed = uploadDocumentMetadataSchema.safeParse({
    entityId: form.get("entityId"),
    documentId: form.get("documentId") || undefined,
    type: form.get("type"),
    title: typeof form.get("title") === "string" ? (form.get("title") as string).trim() : form.get("title"),
    financialYearId: form.get("financialYearId"),
    quarter: form.get("quarter") || undefined,
    changeNote: form.get("changeNote") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const { document, version } = await createDocumentVersion(user, {
      ...parsed.data,
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
