import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CountdownTimer } from "@/components/countdown-timer";
import type { DeadlineView } from "@/lib/data/deadlines";

export function DeadlineList({ deadlines, dsacWide }: { deadlines: DeadlineView[]; dsacWide: boolean }) {
  const relevant = deadlines
    .filter((d) => {
      if (dsacWide) return !d.compliance || d.compliance.satisfied < d.compliance.total || d.daysRemaining <= 60;
      return d.isSatisfiedForViewer === false || d.isSatisfiedForViewer === null || d.daysRemaining <= 60;
    })
    .sort((a, b) => {
      const aOverdue = a.daysRemaining < 0 ? 0 : 1;
      const bOverdue = b.daysRemaining < 0 ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return a.daysRemaining - b.daysRemaining;
    })
    .slice(0, 10);

  if (relevant.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="text-muted-foreground py-8 text-center text-sm">Nothing outstanding right now.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {relevant.map((d) => (
        <Card key={d.id}>
          <CardContent className="space-y-1.5 py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{d.title}</p>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                Due {new Date(d.dueDate).toLocaleDateString("en-ZA")}
              </Badge>
            </div>
            <CountdownTimer dueDate={d.dueDate} />

            {!dsacWide && d.isSatisfiedForViewer !== null && (
              <p className={`flex items-center gap-1 text-xs ${d.isSatisfiedForViewer ? "text-[var(--status-good)]" : "text-muted-foreground"}`}>
                {d.isSatisfiedForViewer ? <CheckCircle2Icon className="size-3.5" /> : <CircleIcon className="size-3.5" />}
                {d.isSatisfiedForViewer ? "Submitted" : "Not yet submitted"}
              </p>
            )}

            {dsacWide && d.compliance && (
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">
                  {d.compliance.satisfied}/{d.compliance.total} entities have submitted
                </p>
                {d.compliance.outstandingEntities.length > 0 && (
                  <p className="text-muted-foreground text-[11px]">
                    Outstanding: {d.compliance.outstandingEntities.map((e) => e.name).join(", ")}
                    {d.compliance.total - d.compliance.satisfied > d.compliance.outstandingEntities.length ? "…" : ""}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
