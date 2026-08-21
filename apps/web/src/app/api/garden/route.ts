import { type NextRequest, NextResponse } from "next/server";

import { sessionOrDenied } from "@/garden/server/guard";
import { resolveForest } from "@/lib/revenue/forest";
import { resolveScope, spectatorScope } from "@/lib/startups";

/**
 * The signed-in user's garden — their own subscriptions, or nothing.
 *
 * **There is no sample book to fall back to.** This used to serve a generated
 * business to anyone who had not connected a provider; it does not any more. A
 * user with no connections gets `gardenState: null` and the reason, and the client
 * draws an empty plot that says what to do about it. Invented customers on a
 * revenue dashboard are worse than an empty one.
 *
 * The plan catalogue rides with the book, because on a real book those plan names
 * are the user's own.
 *
 * **`?startup=<id>` serves somebody else's public forest.** The Forests board
 * links to a full view of any startup its founder has stood in the open; the gate
 * is `spectatorScope` — public, or the viewer's own — and everything else 404s
 * rather than admitting the startup exists. The book is derived from the owner's
 * connections through the same caches their own plot uses, so a spectator costs
 * no extra provider calls and never opens a sealed key of their own.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const gate = await sessionOrDenied();
  if (gate.denied) return gate.denied;

  const spectate = request.nextUrl.searchParams.get("startup");
  if (spectate) {
    const grant = await spectatorScope(gate.userId, spectate);
    if (!grant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const resolved = await resolveForest(grant.ownerId, grant.scope);
    if (resolved.forest) {
      return NextResponse.json({
        gardenState: resolved.forest.garden,
        weatherState: resolved.forest.weather,
        planCatalogue: resolved.forest.planCatalogue,
        source: "live",
        live: resolved.forest.source,
        startup: null,
        scope: spectate,
      });
    }
    return NextResponse.json({
      gardenState: null,
      source: "empty",
      connected: resolved.connected,
      providers: resolved.providers,
      startup: null,
      scope: spectate,
      note:
        resolved.connected === 0
          ? null
          : `${resolved.providers.join(" · ")} connected, with no subscriptions yet.`,
    });
  }

  // Which business this browser is looking at. A cookie, validated against the
  // user's own startups on every request.
  const { scope, active, activeId } = await resolveScope(gate.userId);
  const resolved = await resolveForest(gate.userId, scope);

  if (resolved.forest) {
    return NextResponse.json({
      gardenState: resolved.forest.garden,
      weatherState: resolved.forest.weather,
      planCatalogue: resolved.forest.planCatalogue,
      source: "live",
      live: resolved.forest.source,
      startup: active ? { id: active.id, name: active.name, emoji: active.emoji } : null,
      scope: activeId,
    });
  }

  return NextResponse.json({
    gardenState: null,
    source: "empty",
    // Which kind of empty: nothing connected at all, or connected and working
    // with an account that has no subscriptions in it yet. The plot says which.
    connected: resolved.connected,
    providers: resolved.providers,
    startup: active ? { id: active.id, name: active.name, emoji: active.emoji } : null,
    scope: activeId,
    note:
      resolved.connected === 0
        ? null
        : `${resolved.providers.join(" · ")} connected, with no subscriptions yet.`,
  });
}
