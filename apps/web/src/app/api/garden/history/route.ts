import { NextResponse } from "next/server";

import { sessionOrDenied } from "@/garden/server/guard";
import { liveForest } from "@/lib/revenue/forest";
import { resolveScope } from "@/lib/startups";

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
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const gate = await sessionOrDenied();
  if (gate.denied) return gate.denied;

  const { scope } = await resolveScope(gate.userId);
  const forest = await liveForest(gate.userId, scope);

  return NextResponse.json({
    snapshots: forest?.snapshots ?? [],
    source: forest ? "live" : "empty",
  });
}
