import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { askTheData } from "@/lib/ai/ask-the-data";

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const body = await request.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question.trim() : "";

  if (!question) {
    return NextResponse.json({ error: "A question is required." }, { status: 400 });
  }
  if (question.length > 500) {
    return NextResponse.json({ error: "Keep questions under 500 characters." }, { status: 400 });
  }

  try {
    const result = await askTheData(user, question);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to answer question.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
