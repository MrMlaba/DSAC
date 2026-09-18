import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { createComment } from "@/lib/data/comments";
import { checkOrigin } from "@/lib/origin-check";
import { createCommentSchema } from "@/lib/validation/comment";

export async function POST(request: NextRequest) {
  const originError = checkOrigin(request);
  if (originError) return originError;

  const user = await requireUser();
  const body = await request.json().catch(() => ({}));
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  try {
    const comment = await createComment(user, parsed.data);
    return NextResponse.json({ commentId: comment.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to post comment.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Forbidden") ? 403 : 400 });
  }
}
