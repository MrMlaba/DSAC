const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const twoDecimals = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** "R5,000,000" — the exact figure, for tables. */
export function formatRand(value: number): string {
  const rounded = Math.round(value);
  return `${rounded < 0 ? "-" : ""}R${integer.format(Math.abs(rounded))}`;
}

/** "R2.4bn", "R11.5m", "R850k" — the same figure, shortened for cards. */
export function formatRandCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}R${twoDecimals.format(abs / 1e9)}bn`;
  if (abs >= 1e6) return `${sign}R${oneDecimal.format(abs / 1e6)}m`;
  if (abs >= 1e3) return `${sign}R${integer.format(abs / 1e3)}k`;
  return `${sign}R${integer.format(abs)}`;
}

/** 0.767 → "76.7%", 0.75 → "75%". null → "—". Always rounds from the unrounded ratio. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${oneDecimal.format(Math.round(value * 1000) / 10)}%`;
}

export function formatNumber(value: number): string {
  return Math.abs(value) >= 100 ? integer.format(value) : twoDecimals.format(value);
}

/** A KPI value in its own unit: "85%" for rates, "9,000" for counts. */
export function formatKpiValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return "—";
  return unit === "%" ? `${formatNumber(value)}%` : formatNumber(value);
}

export function formatSigned(value: number): string {
  const formatted = formatNumber(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
