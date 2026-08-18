"use client";

import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { getAuthConfig } from "@/lib/actions/user";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function SignUpForm() {
  const router = useRouter();
  const { isPending } = authClient.useSession();
  const [authConfig, setAuthConfig] = useState<{
    googleEnabled: boolean;
  } | null>(null);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    getAuthConfig().then(setAuthConfig);
  }, []);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      name: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
        },
        {
          onSuccess: () => {
            router.push("/verify-email");
            toast.success("Check your email to verify your account");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasSocial = authConfig?.googleEnabled;

  async function handleSocialLogin(provider: "google") {
    setSocialLoading(provider);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: "/dashboard",
      });
    } catch {
      toast.error(`Failed to sign in with ${provider}`);
      setSocialLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      {hasSocial && (
        <>
          <div className="flex gap-2">
            {authConfig?.googleEnabled && (
              <button
                type="button"
                className="flex-1 h-8 text-[11px] border border-border/40 hover:border-border/80 flex items-center justify-center gap-1.5 transition-colors cursor-pointer rounded-xl"
                onClick={() => handleSocialLogin("google")}
                disabled={!!socialLoading}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {socialLoading === "google" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Google"
                )}
              </button>
            )}
          </div>
          <div className="relative flex items-center">
            <div className="flex-1 h-px bg-border/40" />
            <span className="px-2.5 text-[10px] text-muted-foreground/40">or</span>
            <div className="flex-1 h-px bg-border/40" />
          </div>
        </>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-3"
      >
        <form.Field name="name">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name} className="text-[11px]">
                Full Name
              </Label>
              <Input
                id={field.name}
                name={field.name}
                type="text"
                placeholder="John Doe"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-8 text-xs"
              />
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-[10px] text-destructive">
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Field name="email">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name} className="text-[11px]">
                Email
              </Label>
              <Input
                id={field.name}
                name={field.name}
                type="email"
                placeholder="you@example.com"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-8 text-xs"
              />
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-[10px] text-destructive">
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name} className="text-[11px]">
                Password
              </Label>
              <div className="relative">
                <Input
                  id={field.name}
                  name={field.name}
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="h-8 text-xs pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-[10px] text-destructive">
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => ({
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {(state: { canSubmit: boolean; isSubmitting: boolean }) => (
            <Button
              type="submit"
              className="w-full h-9 text-xs bg-grad-primary text-white shadow-elev-1 hover:brightness-[1.06]"
              disabled={!state.canSubmit || state.isSubmitting}
            >
              {state.isSubmitting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
