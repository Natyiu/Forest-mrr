import "@Batman/env/web";
import type { NextConfig } from "next";

/* geoip-country reads data/geoip-country.dat with fs at import time, which
   file tracing cannot see — without this glob the .dat files are missing from
   the serverless bundle (ENOENT in /var/task) and every admin action in the
   file dies with it. Only the real pnpm store path may be listed: the module's
   __dirname resolves there at runtime, and a glob through the
   node_modules/geoip-country symlink makes deploy assembly mkdir under a
   symlink (ENOTDIR). */
const geoipData = [
  "../../node_modules/.pnpm/geoip-country@*/node_modules/geoip-country/data/**",
];

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  serverExternalPackages: ["geoip-country"],
  outputFileTracingIncludes: {
    "/admin": geoipData,
    "/admin/analytics": geoipData,
  },
  /* PostHog reverse proxy: the SDK talks to /ingest on our own domain so ad
     blockers filtering *.posthog.com don't drop events. The assets host is a
     separate upstream and must be matched first. PostHog's API uses trailing
     slashes; without skipTrailingSlashRedirect Next 308-redirects them and the
     events die on the redirect. */
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
};

export default nextConfig;
