import { auth } from "@Batman/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSidebar, AdminMobileNav } from "./admin-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  /*
    `admin-skin` is the whole restyle (see index.css). It re-points the shadcn
    variables to the console's green-leaning neutrals and the plot's emerald for
    everything below it, so no page inside /admin names a colour of its own.
  */
  return (
    <div className="admin-skin min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <AdminSidebar />
        <div className="relative flex-1 p-5 md:p-8 min-w-0 md:ml-60">
          {/* Top right, the same corner it is in on every other page. */}
          <div className="absolute right-5 top-5 z-40 md:right-8 md:top-8">
            <ThemeToggle />
          </div>
          <AdminMobileNav />
          {children}
        </div>
      </div>
    </div>
  );
}
