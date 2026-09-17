import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { createComment } from "@/lib/data/comments";

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const body = await request.json().catch(() => ({}));
  const { entityId, documentId, documentVersionId, kpiId, taskId, parentId, body: text, mentionedUserIds } = body as {
    entityId?: string;
    documentId?: string;
    documentVersionId?: string;
    kpiId?: string;
    taskId?: string;
    parentId?: string;
    body?: string;
    mentionedUserIds?: string[];
  };

  if (!entityId || !text?.trim()) {
    return NextResponse.json({ error: "entityId and body are required." }, { status: 400 });
  }

  try {
    const comment = await createComment(user, {
      entityId,
      documentId,
      documentVersionId,
      kpiId,
      taskId,
      parentId,
      body: text,
      mentionedUserIds,
    });
    return NextResponse.json({ commentId: comment.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to post comment.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Forbidden") ? 403 : 400 });
  }
}
