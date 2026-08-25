import { type NextRequest, NextResponse } from "next/server";

import { EMBED_CORS, sessionOrDenied } from "@/garden/server/guard";
import { liveForest } from "@/lib/revenue/forest";
import { embedScope, resolveScope, spectatorScope } from "@/lib/startups";

/**
 * Every monthly close, from the same book `/api/garden` served.
 *
 * The client fetches this *with* the garden rather than after it: taking one
 * without the other splits the app across two different customer bases. That rule
 * is why `liveForest` caches the derived book against the harvest it came from —
 * these two handlers must agree about the plan ladder down to the rung.
 *
 * With nothing connected there is no history, and no sample history to stand in
 * for it: the months come back empty and the plot draws its empty state.
 *
 * **`?startup=<id>` follows the same spectator rule as `/api/garden`** — the two
 * are one book, so they must be gated identically or a viewer could take half of
 * a forest they are not allowed the other half of.
 *
 * **`?embed=<token>` follows `/api/garden`'s embed rule for the same reason** —
 * the iframe takes both halves with the one token, before the session gate,
 * with the same CORS headers and the same 404 for a token that does not open.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: EMBED_CORS });
}

export async function GET(request: NextRequest) {
  const embed = request.nextUrl.searchParams.get("embed");
  if (embed) {
    const grant = await embedScope(embed);
    if (!grant) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: EMBED_CORS });
    }
    const forest = await liveForest(grant.ownerId, grant.scope);
    return NextResponse.json(
      {
        snapshots: forest?.snapshots ?? [],
        source: forest ? "live" : "empty",
      },
      { headers: EMBED_CORS },
    );
  }

  const gate = await sessionOrDenied();
  if (gate.denied) return gate.denied;

  const spectate = request.nextUrl.searchParams.get("startup");
  if (spectate) {
    const grant = await spectatorScope(gate.userId, spectate);
    if (!grant) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const forest = await liveForest(grant.ownerId, grant.scope);
    return NextResponse.json({
      snapshots: forest?.snapshots ?? [],
      source: forest ? "live" : "empty",
    });
  }

  const { scope } = await resolveScope(gate.userId);
  const forest = await liveForest(gate.userId, scope);

  return NextResponse.json({
    snapshots: forest?.snapshots ?? [],
    source: forest ? "live" : "empty",
  });
}
