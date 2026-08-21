import { DM_Sans, Geist_Mono } from "next/font/google";

/**
 * The face of the product — DM Sans, the same family outbid.lol ships.
 * `--font-geist-sans` is kept as the CSS variable name so index.css and
 * `font-sans` follow without a second edit.
 */
export const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const manrope = dmSans;
