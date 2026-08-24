import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Windows without Developer Mode cannot create the symlinks Next uses for standalone tracing.
  // Production containers and Linux CI opt in through NEXT_STANDALONE=true.
  output: process.env.NEXT_STANDALONE === "true" ? "standalone" : undefined,
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@defi-market-intel/core"],
  // Lets Playwright use the loopback host while retaining Next's development-origin checks.
  allowedDevOrigins: ["127.0.0.1"],
  // ESLint runs as a dedicated CI/local check.
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
        },
      ],
    },
  ],
};

export default nextConfig;
