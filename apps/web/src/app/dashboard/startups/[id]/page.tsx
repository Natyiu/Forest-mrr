import { notFound } from "next/navigation";

import { StartupSettings } from "@/components/startups/startup-settings";
import { listConnectionsByStartup } from "@/lib/actions/revenue";
import { requireSession } from "@/lib/session";
import { resolveScope } from "@/lib/startups";

/**
 * One startup's settings.
 *
 * The startup is looked up **inside the user's own list** rather than fetched by id
 * and checked afterwards: a page that reads the row first has already read somebody
 * else's business by the time it decides not to show it. An id that is not theirs is
 * a 404, which is also the honest answer — as far as this account is concerned, it
 * does not exist.
 */
export const dynamic = "force-dynamic";

export default async function StartupSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const [groups, { activeId }] = await Promise.all([
    listConnectionsByStartup(),
    resolveScope(session.user.id),
  ]);

  const group = groups.find((entry) => entry.startup.id === id);
  if (!group) notFound();

  return (
    <StartupSettings
      startup={group.startup}
      connections={group.connections}
      isActive={activeId === group.startup.id}
      otherStartupCount={groups.length - 1}
    />
  );
}
