// Per-process presence state. Fine for this single-instance demo; a
// horizontally-scaled deployment would need this in Postgres or Redis
// instead, same as the pg-listener's event bus already is (via NOTIFY).
const globalForPresence = globalThis as unknown as {
  presenceByEntity: Map<string, Map<string, { userId: string; name: string }>> | undefined;
};

function store() {
  if (!globalForPresence.presenceByEntity) globalForPresence.presenceByEntity = new Map();
  return globalForPresence.presenceByEntity;
}

export function addPresence(entityId: string, connectionId: string, userId: string, name: string) {
  const entityMap = store().get(entityId) ?? new Map();
  entityMap.set(connectionId, { userId, name });
  store().set(entityId, entityMap);
  return listPresence(entityId);
}

export function removePresence(entityId: string, connectionId: string) {
  store().get(entityId)?.delete(connectionId);
  return listPresence(entityId);
}

/** Deduped by user — the same person with two tabs open shows once. */
export function listPresence(entityId: string): { userId: string; name: string }[] {
  const entityMap = store().get(entityId);
  if (!entityMap) return [];
  const seen = new Map<string, string>();
  for (const v of entityMap.values()) seen.set(v.userId, v.name);
  return [...seen.entries()].map(([userId, name]) => ({ userId, name }));
}
