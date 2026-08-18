import { Manrope } from "next/font/google";

/**
 * The marketing face. The app itself is set in Geist (`app/layout.tsx`); the
 * landing page and the auth screens — the surfaces a person meets before they
 * are inside — take Manrope, applied on each of those roots rather than on
 * `<html>` so nothing behind the login changes family. One instance here, so
 * the two surfaces cannot load the font twice.
 */
export const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
});
