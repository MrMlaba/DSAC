import { handleMutation } from "@/lib/api-guard";
import { saveExpenditureEntries } from "@/lib/data/capture";
import { expenditureCaptureSchema } from "@/lib/validation/reporting";

export async function POST(request: Request) {
  return handleMutation(request, expenditureCaptureSchema, ({ user, body, ip }) => saveExpenditureEntries(user, body, ip));
}
