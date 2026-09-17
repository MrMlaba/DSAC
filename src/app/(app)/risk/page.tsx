import { Card, CardContent } from "@/components/ui/card";
import { Accordion } from "@/components/ui/accordion";
import { requireUser } from "@/lib/current-user";
import { canReviewDocuments, isDsacWideRole } from "@/lib/constants";
import { listEntityRisk } from "@/lib/data/risk";
import { listDeadlines } from "@/lib/data/deadlines";
import { RiskExplainCard } from "@/components/risk-explain-card";
import { DeadlineList } from "@/components/deadline-list";
import { RecalculateRiskButton } from "@/components/recalculate-risk-button";

export default async function RiskPage() {
  const user = await requireUser();
  const dsacWide = isDsacWideRole(user.role);
  const [riskList, deadlines] = await Promise.all([listEntityRisk(user), listDeadlines(user)]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Early Warning</h1>
          <p className="text-muted-foreground text-sm">
            Explainable risk scores, deadline countdowns and predicted misses — computed from this platform&apos;s own data.
          </p>
        </div>
        {canReviewDocuments(user.role) && <RecalculateRiskButton />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">{dsacWide ? "Entities by risk" : "Your risk score"}</h2>
          {riskList.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="text-muted-foreground py-8 text-center text-sm">
                No risk score computed yet. {canReviewDocuments(user.role) ? "Click \"Recalculate now\" above." : "Check back shortly."}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-1">
                <Accordion defaultValue={dsacWide ? [riskList[0]?.entityId] : [riskList[0]?.entityId]}>
                  {riskList.map((risk) => (
                    <RiskExplainCard key={risk.entityId} risk={risk} showName={dsacWide} />
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Deadlines</h2>
          <DeadlineList deadlines={deadlines} dsacWide={dsacWide} />
        </div>
      </div>
    </div>
  );
}
