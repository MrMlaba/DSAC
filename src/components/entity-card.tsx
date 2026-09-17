import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RiskBadge } from "@/components/risk-badge";
import { MagnitudeBar } from "@/components/proportion-bar";
import { SECTOR_LABELS, ENTITY_TYPE_LABELS } from "@/lib/constants";
import type { PortfolioEntityRow } from "@/lib/data/portfolio";

export function EntityCard({ entity }: { entity: PortfolioEntityRow }) {
  const achieved = entity.kpiStatusCounts.ACHIEVED;
  return (
    <Link href={`/entities/${entity.id}`} className="block">
      <Card className="hover:border-primary/40 h-full transition-colors">
        <CardHeader className="gap-1.5 pb-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm leading-snug font-medium">{entity.name}</p>
            <RiskBadge band={entity.riskBand} score={entity.riskScore} className="shrink-0" />
          </div>
          <p className="text-muted-foreground text-xs">
            {SECTOR_LABELS[entity.sector]} · {ENTITY_TYPE_LABELS[entity.type]}
          </p>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">KPIs achieved</span>
            <span className="font-medium tabular-nums">
              {achieved}/{entity.totalKpis}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Fund utilisation</span>
            <span className="font-medium tabular-nums">
              {entity.utilisationRate !== null ? `${Math.round(entity.utilisationRate * 100)}%` : "—"}
            </span>
          </div>
          {entity.utilisationRate !== null && <MagnitudeBar value={entity.utilisationRate} />}
        </CardContent>
      </Card>
    </Link>
  );
}
