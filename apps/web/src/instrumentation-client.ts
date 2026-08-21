import posthog from "posthog-js";

// api_host is the /ingest reverse proxy (see next.config.ts) so ad blockers
// filtering *.posthog.com don't drop events; ui_host tells the SDK where the
// real PostHog app lives for toolbar/links.
posthog.init("phc_yaVqYvVH3drSs5KQmH6sfDq4MNiUoFSHq2nQ6aWtrSRV", {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  defaults: "2026-05-30",
});
