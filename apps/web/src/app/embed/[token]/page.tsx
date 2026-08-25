import type { Metadata } from "next";
import { notFound } from "next/navigation";

import prisma from "@Batman/db";

import { ForestEmbed } from "@/components/forests/forest-embed";

/**
 * **The forest, framed** — `/embed/<token>`, the page an `<iframe>` on a
 * founder's own landing page points at.
 *
 * There is no session here and nothing to sign into: the token in the path is
 * the whole permission, minted on the startup's settings page and checked
 * against `Startup.embedToken`. An unknown or revoked token is a 404 — the same
 * answer a private forest gives, because as far as this visitor is concerned it
 * does not exist. The plot itself is the real renderer in spectate mode, served
 * the owner's book by `/api/garden?embed=` through the same caches their own
 * dashboard reads, so a busy landing page costs no extra provider calls.
 *
 * The page paints nothing behind the plot — `html` and `body` are made
 * transparent, which browsers pass through an iframe — so the forest stands on
 * the host site's own surface, the way the spectator frame stands on the
 * board's card. Which mode it is lit for is the *founder's* choice, carried as
 * `?theme=dark` on the URL: an embed is part of a page somebody designed, and
 * the visitor's preference for this app is a preference about this app, not
 * about theirs. The inline script pins `data-mode` before first paint for the
 * same reason the root layout's script exists — a dark embed must not open on
 * a light frame — and it has to re-say it because that script answered with
 * the visitor's stored value.
 *
 * Deliberately not indexed: the token is unguessable, and a search engine
 * putting it on a results page would spend that property for nothing.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const startup = await prisma.startup.findUnique({
    where: { embedToken: token },
    select: { name: true },
  });
  return {
    title: startup ? `${startup.name} — a living forest of its revenue` : "Forest MRR",
    robots: { index: false, follow: false },
  };
}

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ theme?: string }>;
}) {
  const [{ token }, search] = await Promise.all([params, searchParams]);

  const startup = await prisma.startup.findUnique({
    where: { embedToken: token },
    select: { id: true },
  });
  if (!startup) notFound();

  const mode = search.theme === "dark" ? "dark" : "light";

  return (
    <>
      <style>{`html, body { background: transparent; }`}</style>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var d=document.documentElement;d.dataset.mode=${JSON.stringify(mode)};d.style.colorScheme=${JSON.stringify(mode)};})();`,
        }}
      />
      <div className="h-screen w-screen overflow-hidden">
        <ForestEmbed token={token} mode={mode} />
      </div>
    </>
  );
}
