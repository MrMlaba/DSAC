import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

export default nextConfig;
