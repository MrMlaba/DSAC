import { headers } from "next/headers";

function extractIp(get: (name: string) => string | null): string | null {
  const forwardedFor = get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return get("x-real-ip");
}

/** Best-effort — meaningful in production behind a reverse proxy, not for local dev. See docs/SECURITY.md §4. For server components/pages, which don't have a request object in scope. */
export async function getRequestIp(): Promise<string | null> {
  const h = await headers();
  return extractIp((name) => h.get(name));
}

/** Same as getRequestIp(), for route handlers that already have a Request/NextRequest in scope. */
export function getIpFromHeaders(requestHeaders: Headers): string | null {
  return extractIp((name) => requestHeaders.get(name));
}
