import { auth } from "@Batman/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * The garden's API is behind the same door the garden is.
 *
 * Standalone, this had no auth because it had no users — it was one Express
 * process serving one plot, and the book was invented. It is not any more: every
 * `/api/garden/*` response is now built from the signed-in user's own payment
 * providers, so these handlers return somebody's actual revenue and the door is
 * the whole point rather than a precaution.
 *
 * Returns a 401 to reject with, or `null` to carry on.
 */
export async function requireSession(): Promise<NextResponse | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) return null;
  return NextResponse.json({ error: "Not signed in." }, { status: 401 });
}

/**
 * The same door, but it tells you *who* came through it.
 *
 * The book stopped being the same for everybody the moment a user could connect
 * their own Stripe: a handler now has to know whose plot it is serving. Returns
 * either the user id or the 401 to return.
 */
export async function sessionOrDenied(): Promise<
  { userId: string; denied?: undefined } | { denied: NextResponse; userId?: undefined }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) return { userId: session.user.id };
  return { denied: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
}
