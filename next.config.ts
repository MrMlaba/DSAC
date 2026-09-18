import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

// `unsafe-eval` is only needed for webpack's dev-mode HMR runtime — dropped in production.
// `unsafe-inline` stays in both: Next's hydration data script and this app's extensive use of
// React inline `style={{...}}` (dynamic risk/status colors) both need it, and a nonce-based CSP
// is a bigger lift than a hackathon prototype needs. Documented as a known trade-off in
// docs/SECURITY.md rather than left silent.
function buildCsp(isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  async headers() {
    const isDev = process.env.NODE_ENV === "development";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: buildCsp(isDev) },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  // This dev machine has 12 logical CPUs but only 8GB RAM. Next's default
  // build-worker pool scales with CPU count, which was spawning enough
  // parallel workers to exhaust memory and crash mid-compile on the
  // heaviest pages (entities/[id], with three Recharts charts). Capping it
  // avoids the OOM/"Jest worker encountered N child process exceptions" crash.
  experimental: {
    cpus: 2,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // The persistent filesystem cache also raced with antivirus file
      // locks on Windows (EPERM on cache pack rename), which could cascade
      // into the same worker crash. In-memory-only cache in dev avoids it.
      config.cache = false;
    }
    return config;
  },
};

export default withPWA({
  dest: "public",
  // Disabled in dev: a service worker aggressively caching JS/CSS chunks
  // during active development would reproduce the exact stale-asset
  // confusion this project already hit once (see the git history around
  // next.config.ts) — every code change could get masked by a cached
  // response unless manually unregistered. PWA/offline behaviour is only
  // testable via `pnpm build && pnpm start`.
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
  },
})(nextConfig);
