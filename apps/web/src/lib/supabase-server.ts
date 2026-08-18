import { createClient, SupabaseClient } from "@supabase/supabase-js";
import prisma from "@Batman/db";

let _cache: { client: SupabaseClient; url: string; ts: number } | null = null;

export async function getSupabaseAdmin(): Promise<SupabaseClient | null> {
  if (_cache && Date.now() - _cache.ts < 30_000) {
    return _cache.client;
  }

  const settings = await prisma.appSettings
    .findUnique({
      where: { id: "default" },
      select: { supabaseUrl: true, supabaseServiceRoleKey: true },
    })
    .catch(() => null);

  const url =
    settings?.supabaseUrl ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const key = settings?.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !key) return null;

  const client = createClient(url, key);
  _cache = { client, url, ts: Date.now() };
  return client;
}
