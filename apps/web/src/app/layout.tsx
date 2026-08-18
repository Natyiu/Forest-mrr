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

const DEFAULT_TITLE = "Batman — The Dark Knight Boilerplate";
const DEFAULT_DESCRIPTION =
  "A production-ready full-stack boilerplate forged in the shadows of Gotham. Next.js, Prisma, Better Auth, and more.";

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
            __html: `(function(){try{var s=localStorage.getItem('theme')||'system';var r=s==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):s;var d=document.documentElement;d.dataset.mode=r;d.style.colorScheme=r;}catch(e){}})();`,
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
