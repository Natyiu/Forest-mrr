import "@Batman/env/web";
import type { NextConfig } from "next";

/* geoip-country reads data/geoip-country.dat with fs at import time, which
   file tracing cannot see — without these globs the .dat files are missing
   from the serverless bundle (ENOENT in /var/task) and every admin action in
   the file dies with it. Both paths are needed under pnpm: the symlink in this
   app's node_modules and the real store dir it points into. */
const geoipData = [
  "./node_modules/geoip-country/data/**",
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
