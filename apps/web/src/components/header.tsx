"use client";
import Link from "next/link";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

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

export default function Header() {
  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
  ] as const;

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-5 py-2.5">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <BatLogo className="h-4 w-auto text-primary" />
            <span className="text-xs font-semibold tracking-widest uppercase">Forest MRR</span>
          </Link>
          <nav className="flex gap-4">
            {links.map(({ to, label }) => (
              <Link
                key={to}
                href={to}
                className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
      <div className="border-b border-border/30" />
    </div>
  );
}
