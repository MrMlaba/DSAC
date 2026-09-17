"use client";

import { useEffect, useRef } from "react";

/**
 * Subscribes to /api/entities/[id]/events (SSE). `handlers` maps event name
 * to callback; the set of event names is captured once at mount (via ref,
 * so callback identity churn doesn't reconnect the stream) — callers should
 * pass a stable set of event names for the lifetime of the component.
 */
export function useEntityEvents(entityId: string, handlers: Record<string, (data: unknown) => void>) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const source = new EventSource(`/api/entities/${entityId}/events`);
    const listeners: [string, (e: MessageEvent) => void][] = [];

    for (const eventName of Object.keys(handlersRef.current)) {
      const listener = (e: MessageEvent) => handlersRef.current[eventName]?.(JSON.parse(e.data));
      source.addEventListener(eventName, listener);
      listeners.push([eventName, listener]);
    }

    return () => {
      for (const [name, listener] of listeners) source.removeEventListener(name, listener);
      source.close();
    };
  }, [entityId]);
}
