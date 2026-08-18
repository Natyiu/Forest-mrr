"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { joinWaitlist } from "@/lib/actions/waitlist";

type WaitlistSettings = {
  title: string;
  headline: string;
  description: string;
  buttonText: string;
  successMessage: string;
  showName: boolean;
  showCompany: boolean;
  appName: string;
  supportEmail: string;
};

type WaitlistPageProps = {
  settings: WaitlistSettings;
};

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

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Toggle theme"
    >
      {mounted && theme === "dark" ? (
        <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
          <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.17 3.17l1.42 1.42M11.41 11.41l1.42 1.42M3.17 12.83l1.42-1.42M11.41 4.59l1.42-1.42" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
          <path d="M13.5 8.5a5.5 5.5 0 0 1-6-6 5.5 5.5 0 1 0 6 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export function WaitlistPage({ settings }: WaitlistPageProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    const result = await joinWaitlist({
      email,
      name: settings.showName ? name : undefined,
      company: settings.showCompany ? company : undefined,
    });

    if (result.success) {
      setStatus("success");
      setEmail("");
      setName("");
      setCompany("");
    } else {
      setStatus("error");
      setError(result.error);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 flex h-12 items-center justify-between">
          <div className="flex items-center gap-2">
            <BatLogo className="h-3.5 w-auto text-foreground" />
            <span className="text-[11px] font-semibold tracking-widest uppercase">
              {settings.appName}
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full py-16">
          <div className="mb-8 text-center">
            <BatLogo className="h-6 w-auto text-foreground mx-auto mb-6" />
            <h1 className="text-xl font-semibold tracking-tight mb-2">
              {settings.title}
            </h1>
            <p className="text-sm text-muted-foreground mb-2">
              {settings.headline}
            </p>
            {settings.description && (
              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                {settings.description}
              </p>
            )}
          </div>

          {status === "success" ? (
            <div className="rounded-lg border border-border/40 bg-muted/20 px-4 py-6 text-center">
              <p className="text-sm font-medium text-foreground">
                {settings.successMessage}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={status === "loading"}
                  className="h-10 text-sm"
                />
              </div>

              {settings.showName && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={status === "loading"}
                    className="h-10 text-sm"
                  />
                </div>
              )}

              {settings.showCompany && (
                <div className="space-y-2">
                  <Label htmlFor="company" className="text-xs">Company</Label>
                  <Input
                    id="company"
                    type="text"
                    placeholder="Your company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    disabled={status === "loading"}
                    className="h-10 text-sm"
                  />
                </div>
              )}

              {status === "error" && (
                <p className="text-xs text-destructive">{error}</p>
              )}

              <Button
                type="submit"
                disabled={status === "loading"}
                className="w-full h-10 text-sm"
              >
                {status === "loading" ? "Joining..." : settings.buttonText}
              </Button>
            </form>
          )}
        </div>
      </main>

      <footer className="border-t border-border/40 py-4">
        <div className="max-w-2xl flex justify-between mx-auto px-4 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/40">
          <span>{settings.appName}</span>
          <div className="flex gap-x-3 items-center">
            <Link href="/legal/privacy" className="hover:text-muted-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-muted-foreground transition-colors">
              Terms
            </Link>
            {settings.supportEmail && (
              <a href={`mailto:${settings.supportEmail}`} className="hover:text-muted-foreground transition-colors">
                Contact
              </a>
            )}
            <Link href="/login" className="hover:text-muted-foreground transition-colors">
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
