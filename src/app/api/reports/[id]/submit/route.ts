import { handleMutation } from "@/lib/api-guard";
import { submitReport } from "@/lib/data/reports";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleMutation(request, null, async ({ user, ip }) => {
    const report = await submitReport(user, id, ip);
    return { reportId: report.id, status: report.status };
  });
}
