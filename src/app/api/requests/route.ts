import { handleMutation } from "@/lib/api-guard";
import { createRequest } from "@/lib/data/requests";
import { createRequestSchema } from "@/lib/validation/reporting";

export async function POST(request: Request) {
  return handleMutation(request, createRequestSchema, async ({ user, body, ip }) => {
    const created = await createRequest(user, body, ip);
    return { requestId: created.id };
  });
}
