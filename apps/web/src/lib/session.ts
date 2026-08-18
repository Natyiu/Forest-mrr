import { auth } from "@Batman/auth";
import { headers } from "next/headers";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export async function isAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  return session?.user?.role === "admin";
}
