import { handleMutation } from "@/lib/api-guard";
import { decideRequest } from "@/lib/data/requests";
import { requestDecisionSchema } from "@/lib/validation/reporting";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleMutation(request, requestDecisionSchema, async ({ user, body, ip }) => {
    const updated = await decideRequest(user, id, body.action, body.note, ip);
    return { requestId: updated.id, status: updated.status };
  });
}
