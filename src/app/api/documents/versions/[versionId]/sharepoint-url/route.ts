import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { getVersionWithAccess } from "@/lib/data/documents";
import { prisma } from "@/lib/prisma";
import { graph, isGraphConfigured } from "@/lib/microsoft/graph";

export async function GET(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const user = await requireUser();
  const { versionId } = await params;

  try {
    const version = await getVersionWithAccess(user, versionId);
    const entity = await prisma.entity.findUniqueOrThrow({ where: { id: version.document.entityId } });
    const url = await graph.getFileWebUrl({ entityName: entity.name, documentTitle: version.document.title });
    return NextResponse.json({ url, configured: isGraphConfigured });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not found.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Forbidden") ? 403 : 404 });
  }
}
