import { auth } from "@Batman/auth";
import prisma from "@Batman/db";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthVisual } from "@/components/auth-visual";

function BatLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 40"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M50 0C50 0 42 14 30 18C18 22 0 18 0 18C0 18 12 28 20 32C28 36 50 40 50 40C50 40 72 36 80 32C88 28 100 18 100 18C100 18 82 22 70 18C58 14 50 0 50 0Z" />
    </svg>
  );
}

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
    <div className="min-h-screen flex bg-background p-0 lg:p-3 gap-3">
      {/* Left — form side */}
      <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col min-h-screen lg:min-h-0">
        <header>
          <div className="px-6 sm:px-8 lg:px-10">
            <div className="flex h-12 items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <BatLogo className="h-3.5 w-auto text-foreground" />
                <span className="text-[11px] font-semibold tracking-widest uppercase">
                  Batman
                </span>
              </Link>
              <Link
                href="/"
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Back
              </Link>
            </div>
          </div>
        </header>

        {/*
          The form sits on a card rather than on the page. Everything else in
          the app is now an object floating on the grey — a sign-in form flat
          against the background is the one screen that would still look like a
          document.
        */}
        <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
          <div className="w-full max-w-sm rounded-3xl bg-card px-7 py-9 shadow-elev-2">
            {children}
          </div>
        </main>

        <footer className="py-4 px-6 sm:px-8 lg:px-10">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/30">
            <span>&copy; {new Date().getFullYear()} Batman</span>
            <Link href="/legal/privacy" className="hover:text-muted-foreground/60 transition-colors">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-muted-foreground/60 transition-colors">
              Terms
            </Link>
          </div>
        </footer>
      </div>

      {/*
        Right — visual side (hidden on mobile). An inset panel with its own
        radius rather than a full-bleed half: the whole layout is now cards on a
        page, and a hard edge running the height of the screen is the one thing
        that would still read as a split-screen template.
      */}
      <div className="hidden lg:block lg:w-[55%] xl:w-[60%] overflow-hidden rounded-3xl shadow-elev-1">
        <AuthVisual />
      </div>
    </div>
  );
}
