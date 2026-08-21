"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { authClient } from "@/lib/auth-client";

/**
 * Ties PostHog's anonymous visitor to the signed-in account, in one place for
 * every login and logout path. The id is better-auth's user id — stable, unlike
 * an email — with email and name sent as person properties. Watching the
 * session go identified → absent is what calls `reset()`, so a sign-out from
 * any menu clears the identity without every sign-out button knowing about
 * analytics; reset is only called after an identify, because resetting a fresh
 * anonymous visitor just discards their id for a new one.
 */
export function PostHogAuth() {
  const { data: session } = authClient.useSession();
  const identified = useRef<string | null>(null);

  useEffect(() => {
    const user = session?.user;
    if (user) {
      if (identified.current !== user.id) {
        posthog.identify(user.id, { email: user.email, name: user.name });
        identified.current = user.id;
      }
    } else if (identified.current) {
      posthog.reset();
      identified.current = null;
    }
  }, [session]);

  return null;
}
