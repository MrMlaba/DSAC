"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { KPI_STATUS_LABELS } from "@/lib/risk-visuals";
import type { EntityDetail } from "@/lib/data/entity-detail";

const chartConfig = {
  target: { label: "Target", color: "var(--chart-1)" },
  actual: { label: "Actual", color: "var(--chart-2)" },
} satisfies ChartConfig;

const STATUS_PRIORITY: Record<string, number> = { DEADLINE_MISSED: 0, IN_PROGRESS: 1, NOT_STARTED: 2, ACHIEVED: 3 };

export function KpiExplorer({
  kpisForYear,
  kpiYoY,
  selectedFyLabel,
}: {
  kpisForYear: EntityDetail["kpisForYear"];
  kpiYoY: EntityDetail["kpiYoY"];
  selectedFyLabel: string;
}) {
  const sortedKpis = useMemo(
    () => [...kpisForYear].sort((a, b) => (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9)),
    [kpisForYear],
  );
  const [selectedName, setSelectedName] = useState(sortedKpis[0]?.name ?? "");

  const selectedKpi = kpisForYear.find((k) => k.name === selectedName) ?? kpisForYear[0];
  const selectedYoY = kpiYoY.find((k) => k.name === selectedName);

  if (!selectedKpi) {
    return <p className="text-muted-foreground text-sm">No KPIs recorded for this entity yet.</p>;
  }

  const quarterlyData = selectedKpi.quarters.map((q) => ({
    quarter: q.quarter,
    target: q.targetValue,
    actual: q.actualValue,
  }));

  const yoyData =
    selectedYoY?.years.map((y) => ({
      year: `FY ${y.fyLabel}`,
      target: y.annualTarget,
      actual: y.yearEndActual,
    })) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={selectedName} onValueChange={(v) => v && setSelectedName(v)}>
          <SelectTrigger size="sm" className="max-w-full sm:w-80">
            <SelectValue placeholder="Select a KPI" />
          </SelectTrigger>
          <SelectContent>
            {sortedKpis.map((k) => (
              <SelectItem key={k.id} value={k.name}>
                {k.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">
          {KPI_STATUS_LABELS[selectedKpi.status]} · unit: {selectedKpi.unit}
        </Badge>
      </div>

      <Tabs defaultValue="year">
        <TabsList>
          <TabsTrigger value="year">FY {selectedFyLabel} by quarter</TabsTrigger>
          <TabsTrigger value="yoy">3-year comparison</TabsTrigger>
        </TabsList>
        <TabsContent value="year">
          <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
            <BarChart data={quarterlyData} barGap={4}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="quarter" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={40} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="target" fill="var(--color-target)" radius={4} />
              <Bar dataKey="actual" fill="var(--color-actual)" radius={4} />
            </BarChart>
          </ChartContainer>
        </TabsContent>
        <TabsContent value="yoy">
          <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
            <BarChart data={yoyData} barGap={4}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={40} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="target" fill="var(--color-target)" radius={4} />
              <Bar dataKey="actual" fill="var(--color-actual)" radius={4} />
            </BarChart>
          </ChartContainer>
        </TabsContent>
      </Tabs>
    </div>
  );
}
