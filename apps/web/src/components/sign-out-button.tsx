"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton({
  variant = "outline",
  size = "sm",
  children = "Sign out",
}: {
  variant?: "outline" | "default" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon" | "xs" | "icon-xs";
  children?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => {
        authClient.signOut({
          fetchOptions: {
            onSuccess: () => {
              router.push("/");
              router.refresh();
            },
          },
        });
      }}
    >
      {children}
    </Button>
  );
}
