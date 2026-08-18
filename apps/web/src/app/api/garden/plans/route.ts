import { NextResponse } from "next/server";

import { sessionOrDenied } from "@/garden/server/guard";
import { liveForest } from "@/lib/revenue/forest";
import { resolveScope } from "@/lib/startups";

/**
 * The plan ladder on its own, for anything that only needs it.
 *
 * A connected user's ladder is read out of their own plans. There is no default
 * ladder to serve otherwise — the four-rung sample catalogue went with the sample
 * book, and naming plans nobody sells would be the same fiction in a smaller box.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const gate = await sessionOrDenied();
  if (gate.denied) return gate.denied;

  const { scope } = await resolveScope(gate.userId);
  const forest = await liveForest(gate.userId, scope);

  return NextResponse.json({
    plans: forest?.planCatalogue ?? [],
    source: forest ? "live" : "empty",
  });
}
