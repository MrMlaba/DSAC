import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** A summary card: label, one big figure, and a line of context. `exact` shows the unabbreviated figure on hover. */
export function StatCard({
  label,
  value,
  exact,
  hint,
  children,
  className,
}: {
  label: string;
  value: ReactNode;
  exact?: string;
  hint?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums" title={exact}>
          {value}
        </CardTitle>
      </CardHeader>
      {(hint || children) && (
        <CardContent className="space-y-1.5">
          {children}
          {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
        </CardContent>
      )}
    </Card>
  );
}
