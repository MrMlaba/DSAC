import { prisma } from "@/lib/prisma";

/** Broadcasts an event to every SSE subscriber of this entity, via Postgres NOTIFY. */
export async function publishEntityEvent(entityId: string, type: string, data: unknown): Promise<void> {
  const payload = JSON.stringify({ entityId, type, data });
  await prisma.$executeRaw`SELECT pg_notify('entity_events', ${payload})`;
}
