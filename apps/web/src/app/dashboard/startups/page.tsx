import { RevenueConnections } from "@/components/revenue/revenue-connections";
import { listConnectionsByStartup } from "@/lib/actions/revenue";
import { requireSession } from "@/lib/session";
import { resolveScope } from "@/lib/startups";

/**
 * The businesses this account runs, and the keys each one reads from.
 *
 * The heading lives in `RevenueConnections` rather than here, because it shares a
 * line with *New startup* — a title and the action that adds a row to what it names
 * are one band, and splitting them across a server page and a client list is what
 * put two introductions and a stray button on this screen.
 *
 * Connecting is also reachable from inside the plot — it is something you do once,
 * in the middle of looking at your numbers — but *managing* a credential belongs on
 * a page you can link someone to, with room for the reason a key stopped working.
 */
export default async function StartupsPage() {
  const session = await requireSession();
  const [groups, { activeId }] = await Promise.all([
    listConnectionsByStartup(),
    resolveScope(session.user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <RevenueConnections groups={groups} activeId={activeId} />
    </div>
  );
}
