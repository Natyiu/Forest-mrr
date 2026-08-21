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
};

export default nextConfig;
