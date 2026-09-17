"use client";

import { useMemo, useState } from "react";
import { Area, Bar, ComposedChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { KPI_STATUS_LABELS } from "@/lib/risk-visuals";
import type { EntityDetail } from "@/lib/data/entity-detail";

const chartConfig = {
  target: { label: "Target", color: "var(--chart-1)" },
  actual: { label: "Actual", color: "var(--chart-2)" },
  forecast: { label: "Forecast (year-end)", color: "var(--chart-3)" },
} satisfies ChartConfig;

const STATUS_PRIORITY: Record<string, number> = { DEADLINE_MISSED: 0, IN_PROGRESS: 1, NOT_STARTED: 2, ACHIEVED: 3 };

type QuarterPoint = { quarter: string; targetValue: number | null; actualValue: number | null };

/**
 * Linear-trend extrapolation from reported quarters to project the
 * remaining ones, with a confidence band from the fit's residual error
 * (floored at 5% of the annual target so a single data point doesn't
 * produce a degenerate zero-width band).
 */
function projectForecast(quarters: QuarterPoint[], annualTarget: number) {
  const reported = quarters
    .map((q, i) => ({ x: i, y: q.actualValue }))
    .filter((p): p is { x: number; y: number } => p.y !== null);

  if (reported.length === 0) return quarters.map(() => null);

  const n = reported.length;
  const sumX = reported.reduce((s, p) => s + p.x, 0);
  const sumY = reported.reduce((s, p) => s + p.y, 0);
  const sumXY = reported.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = reported.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;

  const residuals = reported.map((p) => p.y - (intercept + slope * p.x));
  const residualStdErr = n > 1 ? Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / (n - 1)) : Math.abs(annualTarget) * 0.1;
  const band = Math.max(residualStdErr * 1.5, Math.abs(annualTarget) * 0.05);

  return quarters.map((q, i) => {
    if (q.actualValue !== null) return null;
    const point = intercept + slope * i;
    return { forecast: point, low: point - band, high: point + band };
  });
}

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

  const forecasts = projectForecast(selectedKpi.quarters, selectedKpi.annualTarget);
  const quarterlyData = selectedKpi.quarters.map((q, i) => {
    const f = forecasts[i];
    return {
      quarter: q.quarter,
      target: q.targetValue,
      actual: q.actualValue,
      forecast: f?.forecast ?? null,
      forecastBase: f ? f.low : null,
      forecastRange: f ? f.high - f.low : null,
    };
  });
  const hasForecast = quarterlyData.some((d) => d.forecast !== null);

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
            <ComposedChart data={quarterlyData} barGap={4}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="quarter" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={40} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="target" fill="var(--color-target)" radius={4} />
              <Bar dataKey="actual" fill="var(--color-actual)" radius={4} />
              {hasForecast && (
                <>
                  <Area dataKey="forecastBase" stackId="forecast" stroke="none" fill="transparent" legendType="none" tooltipType="none" />
                  <Area
                    dataKey="forecastRange"
                    stackId="forecast"
                    stroke="none"
                    fill="var(--color-forecast)"
                    fillOpacity={0.15}
                    name="Forecast range"
                  />
                  <Line dataKey="forecast" stroke="var(--color-forecast)" strokeDasharray="4 4" strokeWidth={2} dot={false} connectNulls />
                </>
              )}
            </ComposedChart>
          </ChartContainer>
          {hasForecast && (
            <p className="text-muted-foreground mt-2 text-xs">
              Dashed line projects the year-end value from quarters reported so far, with a shaded confidence band.
            </p>
          )}
        </TabsContent>
        <TabsContent value="yoy">
          <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
            <ComposedChart data={yoyData} barGap={4}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={40} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="target" fill="var(--color-target)" radius={4} />
              <Bar dataKey="actual" fill="var(--color-actual)" radius={4} />
            </ComposedChart>
          </ChartContainer>
        </TabsContent>
      </Tabs>
    </div>
  );
}
