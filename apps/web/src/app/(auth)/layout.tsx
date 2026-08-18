import { auth } from "@Batman/auth";
import prisma from "@Batman/db";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { manrope } from "@/lib/fonts";

/**
 * **The auth screens are the landing page's language.** Same mint ground
 * (`.forest-landing`, so the `--fl-*` tokens resolve), same wordmark, same
 * face (Manrope), same white card with a big radius floating on it, and the
 * plot standing on the right where the landing page stands it under the
 * headline — because a person arrives here from that page, and a sign-up form
 * in a different product's chrome is a door into a different building.
 *
 * The right panel is `public/auth-plot.svg`, the design's own export of the
 * plot on its rounded mint card. It is drawn as an `<img>` overshooting its
 * frame by 1.5% a side with `object-cover`, which crops the white margin the
 * export carries round its card so the panel's own radius is the only edge.
 *
 * The card, the inputs and the copy inside it keep the theme's tokens — the
 * mint is painted and does not follow light/dark, exactly as the landing page's
 * mint bands do not, and the card on it follows the theme exactly as the cards
 * on those bands do.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
      select: { emailVerificationEnabled: true, maintenanceMode: true },
    });
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerified: true },
    });
    if (settings?.emailVerificationEnabled && user && !user.emailVerified) {
      redirect("/verify-email");
    }
    if (
      settings?.maintenanceMode &&
      (session.user.role as string) !== "admin"
    ) {
      redirect("/maintenance");
    }
    redirect("/dashboard");
  }

  return (
    <div
      className={`${manrope.className} forest-landing flex min-h-screen gap-3 bg-fl-ground p-0 text-fl-ink lg:p-3`}
    >
      {/* Left — form side */}
      <div className="flex min-h-screen w-full flex-col lg:min-h-0 lg:w-[45%] xl:w-[40%]">
        <header>
          {/* Below `lg` the form column is the whole viewport, and the floating
              theme toggle is pinned to its top-right corner, so *Back* steps in
              from the edge to leave it room. */}
          <div className="px-6 pr-16 sm:px-8 sm:pr-16 lg:px-10 lg:pr-10">
            <div className="flex h-16 items-center justify-between lg:h-20">
              <Link href="/" aria-label="Forest MRR" className="flex items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/forest-mrr.svg"
                  alt="Forest MRR"
                  width={159}
                  height={75}
                  className="h-10 w-auto lg:h-12"
                />
              </Link>
              <Link
                href="/"
                className="text-[13px] font-medium text-fl-muted transition-colors hover:text-fl-ink"
              >
                Back
              </Link>
            </div>
          </div>
        </header>

        {/*
          The form sits on a card rather than on the page — the same white card
          with a big radius that carries the landing page's feature copy — so it
          reads as an object on the mint rather than a document.
        */}
        <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-[400px] rounded-[28px] bg-card px-7 py-9 shadow-elev-2 ring-1 ring-border/60 sm:px-9 sm:py-10">
            {children}
          </div>
        </main>

        <footer className="px-6 py-5 sm:px-8 lg:px-10">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-fl-muted/70">
            <span>&copy; {new Date().getFullYear()} Forest MRR</span>
            <Link href="/legal/privacy" className="transition-colors hover:text-fl-ink">
              Privacy
            </Link>
            <Link href="/legal/terms" className="transition-colors hover:text-fl-ink">
              Terms
            </Link>
          </div>
        </footer>
      </div>

      {/*
        Right — the plot (hidden on mobile). An inset panel with its own radius
        rather than a full-bleed half, the way the landing page frames its
        poster: the whole layout is cards on a page, and a hard edge running the
        height of the screen is the one thing that would still read as a
        split-screen template.
      */}
      <div className="relative hidden overflow-hidden rounded-3xl bg-fl-ground shadow-elev-1 lg:block lg:w-[55%] xl:w-[60%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/auth-plot.svg"
          alt=""
          aria-hidden
          className="absolute -inset-[1.5%] h-[103%] w-[103%] max-w-none object-cover object-center"
        />
        <p className="sr-only">
          The Forest MRR plot: an isometric garden of one tree per subscription,
          beside a raised border where each revenue metric grows as its own
          specimen with its value on a stake.
        </p>
      </div>
    </div>
  );
}
