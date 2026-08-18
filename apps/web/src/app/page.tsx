"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";

import { LandingPage } from "./landing-page";
import { getAppSettings } from "@/lib/actions/user";
import { getSiteSettings } from "@/lib/actions/site-settings";

const WaitlistPage = dynamic(() => import("./waitlist-page").then((m) => ({ default: m.WaitlistPage })), {
  ssr: true,
});

const CountdownPage = dynamic(() => import("./countdown-page").then((m) => ({ default: m.CountdownPage })), {
  ssr: true,
});

const CountdownWaitlistPage = dynamic(
  () => import("./countdown-waitlist-page").then((m) => ({ default: m.CountdownWaitlistPage })),
  { ssr: true }
);

export default function Page() {
  const [siteSettings, setSiteSettings] = useState<Awaited<ReturnType<typeof getSiteSettings>> | "loading">("loading");

  useEffect(() => {
    getSiteSettings().then(setSiteSettings);
  }, []);

  if (siteSettings === "loading") {
    return <StarterSkeleton />;
  }
  if (siteSettings?.countdown && siteSettings?.waitlist) {
    return (
      <CountdownWaitlistPage
        countdown={siteSettings.countdown}
        waitlist={siteSettings.waitlist}
      />
    );
  }
  if (siteSettings?.countdown) {
    return <CountdownPage settings={siteSettings.countdown} />;
  }
  if (siteSettings?.waitlist) {
    return <WaitlistPage settings={siteSettings.waitlist} />;
  }
  return <ReadyPage />;
}

function ReadyPage() {
  const [supportEmail, setSupportEmail] = useState<string>("");

  useEffect(() => {
    getAppSettings().then((data) => {
      const email = (data as Record<string, unknown>).supportEmail as string;
      setSupportEmail(email ?? "");
    });
  }, []);

  // The waitlist / countdown gating above is this file's job; the poster itself
  // is `landing-page.tsx`, so neither has to be read to change the other. (There
  // used to be a setup wizard in front of the poster on a fresh install; it is
  // gone, and configuration is the `.env` file's job.)
  return <LandingPage supportEmail={supportEmail} />;
}

function StarterSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 flex h-12 items-center justify-between">
          <div className="h-3.5 w-20 bg-muted/40 animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-14 bg-muted/40 animate-pulse" />
            <div className="h-7 w-20 bg-muted/40 animate-pulse" />
          </div>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full py-16 space-y-6">
          <div className="space-y-3">
            <div className="h-6 w-10 bg-muted/40 animate-pulse" />
            <div className="h-5 w-48 bg-muted/40 animate-pulse" />
            <div className="h-3 w-full bg-muted/30 animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-12 bg-muted/30 animate-pulse" />
            <div className="flex flex-wrap gap-1.5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-6 w-16 bg-muted/30 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
