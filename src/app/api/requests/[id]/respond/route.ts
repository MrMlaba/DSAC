import { handleMutation } from "@/lib/api-guard";
import { respondToRequest } from "@/lib/data/requests";
import { requestRespondSchema } from "@/lib/validation/reporting";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleMutation(request, requestRespondSchema, async ({ user, body, ip }) => {
    const updated = await respondToRequest(user, id, body.note, ip);
    return { requestId: updated.id, status: updated.status };
  });
}
