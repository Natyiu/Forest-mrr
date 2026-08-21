"use client";

import { useEffect, useState, useTransition } from "react";
import { ExternalLink, Megaphone, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type AdSpotRow,
  addAdSpot,
  deleteAdSpot,
  listAdSpots,
} from "@/lib/actions/admin-ads";
import { AD_SLOTS_PER_SIDE } from "@/lib/ads";

/**
 * The sponsor inventory, managed. One row per company standing in the ad
 * spots; deleting a row removes it from the rails and the garden strip on the
 * next render. Adding one is how a Polar order is fulfilled: copy the
 * company, tagline and website out of the order's metadata into this form.
 */
export default function AdminAdsPage() {
  const [rows, setRows] = useState<AdSpotRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [href, setHref] = useState("");
  const [image, setImage] = useState("");

  const load = () => {
    listAdSpots()
      .then(setRows)
      .catch(() => setError("Could not load the ad spots."));
  };
  useEffect(load, []);

  const add = () => {
    startTransition(async () => {
      const result = await addAdSpot({
        name,
        tagline,
        href,
        image: image || undefined,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setName("");
      setTagline("");
      setHref("");
      setImage("");
      load();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await deleteAdSpot({ id });
      if (!result.ok) setError(result.message);
      else setError(null);
      load();
    });
  };

  const total = AD_SLOTS_PER_SIDE * 2;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Ads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The companies standing in the sponsor spots — {rows?.length ?? "…"} of{" "}
          {total} filled. Deleting one frees its spot everywhere at once.
        </p>
      </div>

      {/* Fulfilment: paste a paid order's metadata in, spot goes live. */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4 text-muted-foreground" />
          Add a company
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" maxLength={60} className="h-9" />
          <Input value={href} onChange={(e) => setHref(e.target.value)} placeholder="Website (acme.com)" maxLength={300} className="h-9" />
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="One line on what it does" maxLength={120} className="h-9 sm:col-span-2" />
          <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder="Logo URL or /ads/file.png (optional)" maxLength={300} className="h-9 sm:col-span-2" />
        </div>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <Button size="sm" className="mt-3 h-9 text-xs" onClick={add} disabled={isPending || !name.trim() || !tagline.trim() || !href.trim()}>
          <Plus className="size-3.5" />
          Add to the spots
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-card">
        <header className="flex items-center gap-2 border-b border-border px-5 py-3">
          <Megaphone className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Companies in the spots</h2>
        </header>
        {rows === null ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No companies yet — every spot is open.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row, index) => (
              <li key={row.id} className="flex items-center gap-3 px-5 py-3">
                <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                {row.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.image} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                    {row.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{row.tagline}</p>
                </div>
                <a
                  href={row.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                >
                  {row.href.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  <ExternalLink className="size-3" />
                </a>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 shrink-0 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={isPending}
                  onClick={() => remove(row.id)}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
