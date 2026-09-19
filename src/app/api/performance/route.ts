import { handleMutation } from "@/lib/api-guard";
import { savePerformanceEntries } from "@/lib/data/capture";
import { performanceCaptureSchema } from "@/lib/validation/reporting";

export async function POST(request: Request) {
  return handleMutation(request, performanceCaptureSchema, ({ user, body, ip }) => savePerformanceEntries(user, body, ip));
}
