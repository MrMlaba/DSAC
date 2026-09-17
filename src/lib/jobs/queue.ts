import { PgBoss } from "pg-boss";

// Same singleton-on-globalThis pattern as src/lib/prisma.ts, so this survives
// Next dev's module hot-reloading without opening a second connection pool.
const globalForBoss = globalThis as unknown as { pgBoss: PgBoss | undefined };

export function getQueue(): PgBoss {
  if (!globalForBoss.pgBoss) {
    globalForBoss.pgBoss = new PgBoss(process.env.DATABASE_URL!);
    globalForBoss.pgBoss.on("error", (err) => console.error("[pg-boss]", err));
  }
  return globalForBoss.pgBoss;
}

export const QUEUES = {
  RISK_RECALCULATION: "risk-recalculation",
  DEADLINE_CHECK: "deadline-check",
  WEEKLY_BRIEFING: "weekly-briefing",
} as const;
