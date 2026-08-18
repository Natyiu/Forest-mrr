import { auth } from "@Batman/auth";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard } from "lucide-react";

import { listProductsForPricing } from "@/lib/actions/polar";
import { getSubscriptionStatus } from "@/lib/subscription";
import { Button } from "@/components/ui/button";
import { PricingCard } from "./pricing-card";

export default async function PricingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const { products, error } = await listProductsForPricing();

  const isSubscribed = session?.user
    ? (await getSubscriptionStatus(session.user.id)).isSubscribed
    : false;

  if (isSubscribed) {
    redirect("/dashboard/pro" as never);
  }

  return (
    <div className="w-full max-w-xs mx-auto lg:mx-0 lg:max-w-md">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px w-6 bg-foreground" />
          <span className="text-[9px] font-mono tracking-widest uppercase text-muted-foreground/50">
            Plans
          </span>
        </div>
        <h1 className="text-lg font-semibold tracking-tight">
          Choose your plan
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cancel anytime. No surprises.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 border border-destructive/30 bg-destructive/5 text-center">
          <p className="text-xs text-destructive">{error}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Configure Polar in Admin → API Keys (Products → API Keys).
          </p>
        </div>
      )}

      {products.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border/60 rounded-xl">
          <CreditCard className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-xs text-muted-foreground text-center">
            No products configured yet.
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-1 text-center">
            Create products in Admin → Products to display them here.
          </p>
          {session?.user && (
            <Button asChild variant="outline" size="sm" className="mt-5 h-8 text-[11px]">
              <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product) => (
            <PricingCard
              key={product.id}
              product={product}
              isLoggedIn={!!session?.user}
            />
          ))}
        </div>
      )}

      {products.length > 0 && !session?.user && (
        <div className="mt-8 pt-6 border-t border-border/40">
          <p className="text-[11px] text-muted-foreground text-center mb-4">
            Sign in to subscribe
          </p>
          <div className="flex gap-2">
            <Button asChild className="flex-1 h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/login?callbackUrl=/pricing">Sign in</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1 h-8 text-[11px] border-border/40 hover:border-border/80">
              <Link href="/signup?callbackUrl=/pricing">Sign up</Link>
            </Button>
          </div>
        </div>
      )}

      {products.length > 0 && session?.user && (
        <div className="mt-8 text-center">
          <Button asChild variant="ghost" size="sm" className="h-8 text-[11px] text-muted-foreground hover:text-foreground">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
