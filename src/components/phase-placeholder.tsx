import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PhasePlaceholder({
  icon: Icon,
  title,
  phase,
  description,
}: {
  icon: LucideIcon;
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Card className="border-dashed">
        <CardHeader className="items-center text-center">
          <div className="bg-muted mb-2 flex size-12 items-center justify-center rounded-full">
            <Icon className="text-muted-foreground size-6" />
          </div>
          <CardTitle>Coming in {phase}</CardTitle>
          <CardDescription>This module isn&apos;t built yet — the navigation and route already exist.</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
