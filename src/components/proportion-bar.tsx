interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** A single composition bar (stacked, thin, rounded ends) with a legend row below. */
export function ProportionBar({ segments, className }: { segments: Segment[]; className?: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className={className}>
      <div className="bg-muted flex h-2.5 w-full overflow-hidden rounded-full">
        {total === 0 ? (
          <div className="bg-muted h-full w-full" />
        ) : (
          segments.map((segment, i) => {
            const pct = (segment.value / total) * 100;
            if (pct <= 0) return null;
            return (
              <div
                key={segment.key}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: segment.color,
                  marginLeft: i === 0 ? 0 : 2,
                }}
                title={`${segment.label}: ${segment.value}`}
              />
            );
          })
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((segment) => (
          <div key={segment.key} className="flex items-center gap-1.5 text-xs">
            <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: segment.color }} />
            <span className="text-muted-foreground">{segment.label}</span>
            <span className="font-medium tabular-nums">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A single-value magnitude bar (e.g. utilisation %, compliance %) on a sequential hue. */
export function MagnitudeBar({
  value,
  max = 1,
  color = "var(--chart-1)",
  className,
}: {
  value: number;
  max?: number;
  color?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`bg-muted h-2 w-full overflow-hidden rounded-full ${className ?? ""}`}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}
