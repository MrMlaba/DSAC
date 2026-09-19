"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";
import type { EntityProfileData } from "@/lib/data/entity-profile";

const chartConfig = {
  permanent: { label: "Permanent", color: "var(--chart-1)" },
  temporary: { label: "Temporary", color: "var(--chart-2)" },
  youth: { label: "Youth", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function JobCreationChart({ jobCreationByYear }: { jobCreationByYear: EntityProfileData["jobCreationByYear"] }) {
  const data = jobCreationByYear.map((j) => ({
    year: `FY ${j.fyLabel}`,
    permanent: j.permanent,
    temporary: j.temporary,
    youth: j.youth,
  }));

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <BarChart data={data} barGap={4}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="year" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="permanent" stackId="jobs" fill="var(--color-permanent)" radius={[0, 0, 4, 4]} />
        <Bar dataKey="temporary" stackId="jobs" fill="var(--color-temporary)" />
        <Bar dataKey="youth" stackId="jobs" fill="var(--color-youth)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
