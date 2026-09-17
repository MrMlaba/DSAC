import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { RiskBadge } from "@/components/risk-badge";
import { Progress } from "@/components/ui/progress";
import type { EntityRiskView } from "@/lib/data/risk";

export function RiskExplainCard({ risk, showName }: { risk: EntityRiskView; showName: boolean }) {
  return (
    <AccordionItem value={risk.entityId}>
      <AccordionTrigger>
        <div className="flex flex-1 items-center justify-between pr-2">
          <span>{showName ? risk.entityName : "Risk breakdown"}</span>
          <RiskBadge band={risk.band} score={risk.score} />
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">P(miss next target)</p>
              <p className="text-sm font-medium tabular-nums">{Math.round(risk.probabilityMissTarget * 100)}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">P(late next submission)</p>
              <p className="text-sm font-medium tabular-nums">{Math.round(risk.probabilityLateSubmission * 100)}%</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Why am I seeing this?</p>
            {risk.factors.map((f) => (
              <div key={f.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{f.label}</span>
                  <span className="text-muted-foreground tabular-nums">{Math.round(f.contribution)} pts</span>
                </div>
                <Progress value={Math.min(100, f.contribution * 4)} className="h-1.5" />
                <p className="text-muted-foreground text-[11px]">{f.detail}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-[10px]">Computed {new Date(risk.computedAt).toLocaleString("en-ZA")}</p>
            {showName && (
              <Link href={`/entities/${risk.entityId}`} className="text-primary flex items-center gap-1 text-xs hover:underline">
                View entity <ArrowRightIcon className="size-3" />
              </Link>
            )}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
