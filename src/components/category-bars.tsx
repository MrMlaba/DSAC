interface CategoryBarItem {
  label: string;
  value: number;
  color: string;
}

export function CategoryBars({ items, className }: { items: CategoryBarItem[]; className?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground w-28 shrink-0 truncate">{item.label}</span>
          <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }}
            />
          </div>
          <span className="w-8 shrink-0 text-right font-medium tabular-nums">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
