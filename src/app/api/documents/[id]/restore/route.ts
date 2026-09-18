import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { restoreDeletedDocument } from "@/lib/data/documents";
import { checkOrigin } from "@/lib/origin-check";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = checkOrigin(request);
  if (originError) return originError;

  const user = await requireUser();
  const { id } = await params;

  try {
    await restoreDeletedDocument(user, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Restore failed.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Forbidden") ? 403 : 400 });
  }
}
