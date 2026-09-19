import { handleMutation } from "@/lib/api-guard";
import { reviewReport } from "@/lib/data/reports";
import { reportReviewSchema } from "@/lib/validation/reporting";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleMutation(request, reportReviewSchema, async ({ user, body, ip }) => {
    const report = await reviewReport(user, id, body.action, body.comment, ip);
    return { reportId: report.id, status: report.status };
  });
}
