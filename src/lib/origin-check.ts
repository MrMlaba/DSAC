import { NextResponse } from "next/server";

/**
 * Defense-in-depth against CSRF on custom mutating API routes, alongside
 * SameSite=Lax session cookies. Browsers always send an Origin header on
 * cross-site fetch/XHR; a same-origin request from our own client code has
 * one that matches request.nextUrl.origin. Returns a 403 response to short-
 * circuit with, or null to continue. See docs/SECURITY.md §7.
 */
export function checkOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null; // no Origin header (e.g. same-origin form nav, some non-browser clients) — SameSite cookies still apply
  const expected = new URL(request.url).origin;
  if (origin !== expected) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  return null;
}
