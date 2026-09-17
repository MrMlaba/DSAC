import { Badge } from "@/components/ui/badge";
import { AUDIT_OPINION_LABELS } from "@/lib/constants";
import { AUDIT_SEVERITY_VISUALS } from "@/lib/risk-visuals";
import type { EntityDetail } from "@/lib/data/entity-detail";

export function AuditHistory({ auditHistory }: { auditHistory: EntityDetail["auditHistory"] }) {
  if (auditHistory.length === 0) {
    return <p className="text-muted-foreground text-sm">No audit findings recorded.</p>;
  }

  return (
    <div className="space-y-4">
      {auditHistory.map((year) => (
        <div key={year.fyLabel} className="border-border/60 border-l-2 pl-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">FY {year.fyLabel}</p>
            {year.opinion && (
              <Badge variant="outline" className="text-xs">
                {AUDIT_OPINION_LABELS[year.opinion as keyof typeof AUDIT_OPINION_LABELS]}
              </Badge>
            )}
          </div>
          {year.findings.length === 0 ? (
            <p className="text-muted-foreground mt-1 text-xs">No findings.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {year.findings.map((finding) => {
                const visual = AUDIT_SEVERITY_VISUALS[finding.severity];
                const Icon = visual.icon;
                return (
                  <li key={finding.id} className="flex items-start gap-2 text-xs">
                    <Icon className="mt-0.5 size-3.5 shrink-0" style={{ color: visual.color }} />
                    <span>
                      <span className="font-medium">{finding.category}</span>
                      {" — "}
                      <span className="text-muted-foreground">{finding.description}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        ({finding.status === "RESOLVED" ? "resolved" : "open"})
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
