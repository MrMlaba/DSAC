// In-memory, per-process sliding-window limiter. Adequate for this
// single-instance demo; a horizontally-scaled deployment would need this in
// a shared store (Redis) instead — see docs/SECURITY.md §7.
const globalForRateLimit = globalThis as unknown as { rateLimitBuckets: Map<string, number[]> | undefined };

function store() {
  if (!globalForRateLimit.rateLimitBuckets) globalForRateLimit.rateLimitBuckets = new Map();
  return globalForRateLimit.rateLimitBuckets;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const bucket = store();
  const timestamps = (bucket.get(key) ?? []).filter((t) => now - t < windowMs);

  if (timestamps.length >= limit) {
    bucket.set(key, timestamps);
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((timestamps[0] + windowMs - now) / 1000) };
  }

  timestamps.push(now);
  bucket.set(key, timestamps);
  return { allowed: true, remaining: limit - timestamps.length, retryAfterSeconds: 0 };
}
