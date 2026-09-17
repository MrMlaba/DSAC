import { Client } from "pg";
import { EventEmitter } from "node:events";

const CHANNEL = "entity_events";

export interface EntityEventPayload {
  entityId: string;
  type: string;
  data: unknown;
}

// Same globalThis-singleton pattern as src/lib/prisma.ts and src/lib/jobs/queue.ts,
// so this survives Next dev's module hot-reloading without opening a second
// LISTEN connection every time a file changes.
const globalForListener = globalThis as unknown as {
  pgListenerClient: Client | undefined;
  pgListenerEmitter: EventEmitter | undefined;
  pgListenerConnecting: Promise<void> | undefined;
};

function getEmitter(): EventEmitter {
  if (!globalForListener.pgListenerEmitter) {
    globalForListener.pgListenerEmitter = new EventEmitter();
    globalForListener.pgListenerEmitter.setMaxListeners(500); // one SSE connection per active viewer
  }
  return globalForListener.pgListenerEmitter;
}

async function ensureListening(): Promise<void> {
  if (globalForListener.pgListenerClient) return;
  if (globalForListener.pgListenerConnecting) return globalForListener.pgListenerConnecting;

  globalForListener.pgListenerConnecting = (async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);

    client.on("notification", (msg) => {
      if (!msg.payload) return;
      try {
        const payload = JSON.parse(msg.payload) as EntityEventPayload;
        getEmitter().emit(payload.entityId, payload);
      } catch {
        // Malformed payload — drop it rather than crash the listener.
      }
    });

    client.on("error", (err) => {
      console.error("[realtime] Postgres listener connection error:", err);
      globalForListener.pgListenerClient = undefined;
      globalForListener.pgListenerConnecting = undefined;
    });

    globalForListener.pgListenerClient = client;
  })();

  return globalForListener.pgListenerConnecting;
}

/** Subscribes to events for one entity. Returns an unsubscribe function. */
export async function subscribeToEntity(entityId: string, handler: (payload: EntityEventPayload) => void): Promise<() => void> {
  await ensureListening();
  const emitter = getEmitter();
  emitter.on(entityId, handler);
  return () => emitter.off(entityId, handler);
}
