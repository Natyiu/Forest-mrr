"use client";

// import { MadeByBadge } from "./made-by";
import { PostHogAuth } from "./posthog-auth";
import { ThemeProvider } from "./theme-provider";
import { ThemeSync } from "./theme-sync";
import { FloatingThemeToggle } from "./theme-toggle";
import { Toaster } from "./ui/sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} themes={["light", "dark"]} disableTransitionOnChange>
      <ThemeSync />
      <PostHogAuth />
      {children}
      {/* The corner switch for pages with no chrome of their own; it stands down
          inside /dashboard and /admin, which carry it in their own top bar. */}
      <FloatingThemeToggle />
      {/* The designer credit, commented out for now — see made-by.tsx. */}
      {/* <MadeByBadge /> */}
      <Toaster />
    </ThemeProvider>
  );
}
