/**
 * Standalone background-job worker — deliberately NOT wired through Next.js
 * instrumentation.ts. pg-boss depends on `pg`, which Next tries to bundle
 * into instrumentation.ts's edge-runtime variant too (it's a shared
 * entrypoint compiled for both runtimes, since middleware.ts runs on edge),
 * and that bundle can't resolve `pg`'s Node-only internals ('fs', optional
 * 'pg-native') — a hard, well-known limitation, not something fixable with
 * a runtime guard alone. Running the scheduler as its own process (the
 * conventional pattern for background workers anyway) sidesteps it
 * entirely. `pnpm dev` runs this alongside `next dev` via `concurrently`.
 */
import { getQueue, QUEUES } from "../src/lib/jobs/queue";
import { runRiskRecalculation } from "../src/lib/jobs/risk-recalculation";
import { runDeadlineCheck } from "../src/lib/jobs/deadline-check";
import { runWeeklyBriefing } from "../src/lib/jobs/weekly-briefing";

async function main() {
  const boss = getQueue();
  await boss.start();

  await boss.createQueue(QUEUES.RISK_RECALCULATION);
  await boss.createQueue(QUEUES.DEADLINE_CHECK);
  await boss.createQueue(QUEUES.WEEKLY_BRIEFING);

  await boss.work(QUEUES.RISK_RECALCULATION, async () => {
    const count = await runRiskRecalculation();
    console.log(`[worker] Recalculated risk for ${count} entities.`);
  });
  await boss.work(QUEUES.DEADLINE_CHECK, async () => {
    const count = await runDeadlineCheck();
    console.log(`[worker] Deadline check sent ${count} notification(s).`);
  });
  await boss.work(QUEUES.WEEKLY_BRIEFING, async () => {
    await runWeeklyBriefing();
    console.log("[worker] Weekly briefing sent.");
  });

  // Demo cadence — frequent enough to feel live without hammering Postgres.
  await boss.schedule(QUEUES.RISK_RECALCULATION, "*/15 * * * *");
  await boss.schedule(QUEUES.DEADLINE_CHECK, "*/10 * * * *");
  await boss.schedule(QUEUES.WEEKLY_BRIEFING, "0 7 * * 1");

  // Run once immediately so the demo has fresh data without waiting for the first tick.
  await boss.send(QUEUES.RISK_RECALCULATION);
  await boss.send(QUEUES.DEADLINE_CHECK);

  console.log("[worker] Background job worker started (risk recalculation, deadline checks, weekly briefing).");

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, async () => {
      console.log(`[worker] ${signal} received, stopping...`);
      await boss.stop({ graceful: true, timeout: 5000 });
      process.exit(0);
    });
  }
}

main().catch((error) => {
  console.error("[worker] Failed to start:", error);
  process.exit(1);
});
