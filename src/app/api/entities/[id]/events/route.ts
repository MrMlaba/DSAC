import { nanoid } from "nanoid";
import { requireUser } from "@/lib/current-user";
import { assertEntityAccess } from "@/lib/tenant-scope";
import { subscribeToEntity } from "@/lib/realtime/pg-listener";
import { publishEntityEvent } from "@/lib/realtime/publish";
import { addPresence, removePresence } from "@/lib/realtime/presence";

const HEARTBEAT_MS = 20_000;

/** Server-Sent Events stream for one entity's workspace — comments, task updates, presence. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: entityId } = await params;

  try {
    assertEntityAccess(user, entityId);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const connectionId = nanoid();
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller already closed (client disconnected) — nothing to do.
        }
      }

      unsubscribe = await subscribeToEntity(entityId, (payload) => send(payload.type, payload.data));

      const presence = addPresence(entityId, connectionId, user.id, user.name);
      send("presence.updated", presence);
      await publishEntityEvent(entityId, "presence.updated", presence);

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_MS);
    },
    async cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
      const presence = removePresence(entityId, connectionId);
      await publishEntityEvent(entityId, "presence.updated", presence);
    },
  });

  request.signal.addEventListener("abort", () => {
    unsubscribe?.();
    if (heartbeat) clearInterval(heartbeat);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
