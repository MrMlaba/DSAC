"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";
import type { EntityDetail } from "@/lib/data/entity-detail";

const chartConfig = {
  allocated: { label: "Allocated", color: "var(--chart-1)" },
  spent: { label: "Spent", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function FinanceChart({ finance }: { finance: EntityDetail["finance"] }) {
  const data = finance.map((f) => ({ year: `FY ${f.fyLabel}`, allocated: Math.round(f.allocated), spent: Math.round(f.spent) }));

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <BarChart data={data} barGap={4}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="year" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `R${(v / 1_000_000).toFixed(0)}M`} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="allocated" fill="var(--color-allocated)" radius={4} />
        <Bar dataKey="spent" fill="var(--color-spent)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
