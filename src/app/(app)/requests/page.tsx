import { requireUser } from "@/lib/current-user";
import { canCaptureReportingData, canReviewReports, isDsacWideRole, REQUEST_STATUS_LABELS } from "@/lib/constants";
import { listProgrammes, listRequests } from "@/lib/data/requests";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewRequestDialog } from "@/components/new-request-dialog";
import { RequestsTable, type RequestTableRow } from "@/components/requests-table";
import { formatRand } from "@/lib/format";
import { sumMoney } from "@/lib/calc/money";

export default async function RequestsPage() {
  const user = await requireUser();
  const dsac = isDsacWideRole(user.role);
  const requests = await listRequests(user);
  const programmes = !dsac && user.entityId ? await listProgrammes(user, user.entityId) : [];

  const rows: RequestTableRow[] = requests.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  const count = (...statuses: (keyof typeof REQUEST_STATUS_LABELS)[]) => requests.filter((r) => statuses.includes(r.status)).length;
  const openFunding = sumMoney(requests.filter((r) => r.amountRequested !== null && (r.status === "SUBMITTED" || r.status === "UNDER_REVIEW")).map((r) => r.amountRequested as number));

  return (
    <div className="space-y-6">
      <PageHeader
        title={dsac ? "Requests / Support" : "Requests"}
        description={dsac ? "Budget and support requests from every organisation. Review, decide and respond here." : "Ask DSAC for budget or support and follow the response."}
        actions={!dsac && canCaptureReportingData(user.role) ? <NewRequestDialog programmes={programmes} /> : undefined}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total requests" value={requests.length} />
        <StatCard label="Under review" value={count("SUBMITTED", "UNDER_REVIEW")} hint={`${formatRand(openFunding)} in funding requests awaiting a decision`} />
        <StatCard label="More information required" value={count("MORE_INFO_REQUIRED")} />
        <StatCard label="Approved / completed" value={count("APPROVED", "COMPLETED")} hint={`${count("DECLINED")} declined`} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dsac ? "All requests" : "Your requests"}</CardTitle>
          <CardDescription>Submitted → Under review → Approved / Declined / More information required → Completed. Select a request for its details.</CardDescription>
        </CardHeader>
        <CardContent>
          <RequestsTable rows={rows} mode={dsac ? (canReviewReports(user.role) ? "dsac" : "dsac-readonly") : "entity"} showEntity={dsac} />
        </CardContent>
      </Card>
    </div>
  );
}
