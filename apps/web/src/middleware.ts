import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * A signed-in visitor landing on `/` is sent straight to the app: the landing
 * page is a pitch, and pitching somebody who already has an account is a wrong
 * turn on every visit.
 *
 * The check is the *presence* of better-auth's session cookie, not its
 * validity — middleware runs on every request and must not pay a database
 * read. A stale cookie sends its owner to /dashboard, whose layout does the
 * real check and bounces them to /login; that is the same journey an expired
 * session takes from anywhere else. Both cookie names are checked because
 * better-auth prefixes it with `__Secure-` on https.
 */
export function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/" &&
    (request.cookies.has("better-auth.session_token") ||
      request.cookies.has("__Secure-better-auth.session_token"))
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}
