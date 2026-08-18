import Link from "next/link";
import { auth } from "@Batman/auth";
import prisma from "@Batman/db";
import { headers } from "next/headers";
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

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompleted: true },
  });

  if (user?.onboardingCompleted) {
    redirect("/dashboard");
  }

  let settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    settings = await prisma.appSettings.create({
      data: { id: "default" },
    });
  }

  if (!settings.onboardingEnabled) {
    redirect("/dashboard");
  }

  if (
    settings.maintenanceMode &&
    (session.user.role as string) !== "admin"
  ) {
    redirect("/maintenance" as never);
  }

  return (
    <div className="min-h-screen flex bg-background p-0 lg:p-3 gap-3">
      <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col min-h-screen">
        <header>
          <div className="px-6 sm:px-8 lg:px-10">
            <div className="flex h-12 items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <BatLogo className="h-3.5 w-auto text-foreground" />
                <span className="text-[11px] font-semibold tracking-widest uppercase">
                  Batman
                </span>
              </Link>
              <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                Getting started
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 sm:px-8 lg:px-10 py-12">
          <div className="w-full max-w-sm">{children}</div>
        </main>

        <footer className="py-4 px-6 sm:px-8 lg:px-10">
          <p className="text-[10px] text-muted-foreground/30">
            &copy; {new Date().getFullYear()} Batman
          </p>
        </footer>
      </div>

            {/* Inset panel, matching the sign-in split: the layout is cards on a
          page, and a hard edge running the height of the screen is the one
          thing that would still read as a split-screen template. */}
      <div className="hidden lg:block lg:w-[55%] xl:w-[60%] overflow-hidden rounded-3xl shadow-elev-1">
        <AuthVisual />
      </div>
    </div>
  );
}
