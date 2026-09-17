"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number): { text: string; overdue: boolean } {
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const totalSeconds = Math.floor(abs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let text: string;
  if (days > 0) text = `${days}d ${hours}h`;
  else if (hours > 0) text = `${hours}h ${minutes}m`;
  else text = `${minutes}m ${seconds}s`;

  return { text, overdue };
}

/** Ticks every second in the final day, every minute otherwise — live enough to feel real without redrawing needlessly. */
export function CountdownTimer({ dueDate }: { dueDate: string | Date }) {
  const target = new Date(dueDate).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const msRemaining = target - Date.now();
    const tickMs = Math.abs(msRemaining) < 24 * 60 * 60 * 1000 ? 1000 : 60_000;
    const interval = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(interval);
  }, [target]);

  const { text, overdue } = formatRemaining(target - now);

  return (
    <span className={`font-medium tabular-nums ${overdue ? "text-[var(--status-critical)]" : ""}`}>
      {overdue ? `Overdue by ${text}` : `${text} remaining`}
    </span>
  );
}
