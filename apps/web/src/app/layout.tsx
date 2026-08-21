import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "../index.css";
import Providers from "@/components/providers";
import { getAppSettings } from "@/lib/actions/user";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DEFAULT_TITLE = "Forest MRR — Your revenue, growing";
const DEFAULT_DESCRIPTION =
  "See your subscription revenue as a living garden — one tree per subscription, drawn at the size it actually pays. Connect Stripe, Polar, LemonSqueezy and more.";

/**
 * The favicon, as metadata rather than an `app/icon.svg` file: Next 16.1's
 * Turbopack panics on an SVG app icon during `next build` ("Dependency tracking
 * is disabled so invalidation is not allowed"), so the SVG is served from
 * `public/` instead. `app/icon.png` and `app/apple-icon.png` are real files and
 * fine — the SVG entry here outranks the PNG in browsers that take it.
 */
const ICONS: Metadata["icons"] = {
  icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
};

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getAppSettings();
    const title =
      (settings as { metaTitle?: string | null }).metaTitle?.trim() ||
      (settings as { appName?: string }).appName ||
      DEFAULT_TITLE;
    const description =
      (settings as { metaDescription?: string | null }).metaDescription?.trim() ||
      (settings as { appDescription?: string }).appDescription ||
      DEFAULT_DESCRIPTION;
    const appUrl = (settings as { appUrl?: string }).appUrl?.trim();
    let image = (settings as { ogImage?: string | null }).ogImage?.trim();
    if (image && !image.startsWith("http")) {
      const base = appUrl || process.env.NEXT_PUBLIC_APP_URL || "";
      image = base ? `${base.replace(/\/$/, "")}${image.startsWith("/") ? "" : "/"}${image}` : undefined;
    }
    return {
      title,
      description,
      icons: ICONS,
      openGraph: {
        title,
        description,
        url: appUrl || undefined,
        images: image ? [{ url: image }] : undefined,
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      icons: ICONS,
    };
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The font variables live on <html>, not <body>: index.css applies
  // `font-sans` to the html element too, and a variable defined on <body>
  // cannot be read by the element above it.
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        {/*
          Resolve light/dark before the first paint, from **`next-themes`' own
          key**. The garden's tokens are painted by a layout effect and its
          `data-mode` by `ThemeSync`, both a tick after mount: without this,
          opening any page in dark mode shows a white one for as long as it
          takes React to hydrate.

          It used to read `allotment:mode` — the garden's separate store — which
          is why there were two dark modes that only agreed by luck. There is
          one preference now, under next-themes' `theme` key, and this script and
          next-themes' own inline script read the same value, so the class and
          the attribute cannot disagree on the first frame.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var r=localStorage.getItem('theme')==='dark'?'dark':'light';var d=document.documentElement;d.dataset.mode=r;d.style.colorScheme=r;}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
