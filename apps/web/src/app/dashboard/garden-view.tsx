"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useTheme } from "next-themes";

import { ThemeProvider } from "@/garden/lib/ThemeContext";
import { ConnectRevenueDialog } from "@/components/revenue/connect-revenue-dialog";
import { listRevenueConnections, type RevenueConnectionView } from "@/lib/actions/revenue";

import { GardenAccount, type GardenAccountProps } from "./garden-account";
import { GardenStartup } from "./garden-startup";
import { GardenBrand, GardenNav } from "./garden-chrome";

/**
 * The garden, mounted into the dashboard.
 *
 * Loaded with `ssr: false` on purpose. The plot is a `<canvas>` driven by a
 * `requestAnimationFrame` loop that measures its own container, reads
 * `prefers-reduced-motion` and `matchMedia`, and seeds its weather from
 * `Date.now()` — there is no useful HTML for a server to send, and everything
 * it would render on the server is a frame the client immediately throws away.
 * Rendering it client-side only also keeps the whole sprite/metrics bundle out
 * of the server graph.
 *
 * The skeleton is deliberately just the page gradient. A spinner over a scene
 * that takes one frame to appear reads as a fault rather than as loading.
 */
const GardenApp = dynamic(() => import("@/garden/App"), {
  ssr: false,
  loading: () => <div className="garden-root h-full w-full bg-page" />,
});

/**
 * Only plain data crosses the server boundary; the account menu is composed
 * here, on the client. That keeps `garden/App` unaware of the host app — it
 * takes a node and hangs it in the toolbar — while the menu itself stays where
 * the auth client and the feedback dialog already live.
 *
 * The connect-revenue dialog is owned here for the same reason and mounted
 * *outside* the garden: it is a shadcn form belonging to the host app, and the
 * plot only ever gets a callback. It stands where the Stripe simulator used to —
 * toolbar primary action, `E`, and ⌘K — because that button was always about
 * where the money comes from, and now it is about the real money rather than a
 * fake webhook.
 */
export function GardenView({
  account,
  startup,
}: {
  account: GardenAccountProps;
  /** Which business the plot is drawing, resolved on the server. */
  startup: {
    name: string | null;
    emoji: string | null;
    /** The provider's own logo for this business, when one publishes a fetchable one. */
    image: string | null;
    isAll: boolean;
  };
}) {
  /**
   * Light/dark comes from the app, not from the plot.
   *
   * The garden used to keep its own mode in its own storage key, which made the
   * palette button on this page a switch for this page — turn the plot dark,
   * open Settings, get a white one. It is handed the host's value here and hands
   * changes back, so the toolbar's control, the top bar's toggle and the `d`
   * key are all the same switch. Season stays the garden's: nothing outside the
   * plot has an opinion about which month it is dressed for.
   */
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const [connectOpen, setConnectOpen] = useState(false);
  const [connections, setConnections] = useState<RevenueConnectionView[]>([]);

  const openConnect = useCallback(() => {
    setConnectOpen(true);
    // Fetched on open rather than on mount: the plot does not need anyone's keys
    // to draw itself, and a failed read only costs the "already connected" note.
    void listRevenueConnections()
      .then(setConnections)
      .catch(() => setConnections([]));
  }, []);

  return (
    <ThemeProvider
      mode={theme === "light" || theme === "dark" ? theme : "system"}
      onModeChange={setTheme}
    >
      <GardenApp
        brandSlot={<GardenBrand />}
        navSlot={<GardenNav />}
        accountSlot={<GardenAccount {...account} />}
        startupSlot={
          <GardenStartup
            initialName={startup.name}
            initialEmoji={startup.emoji}
            initialImage={startup.image}
            isAll={startup.isAll}
          />
        }
        onConnectRevenue={openConnect}
        // The route is the host app's to know, so the plot is handed a callback
        // — the same arrangement as the connect dialog above it.
        onCleanView={() => router.push("/dashboard/tv" as never)}
      />

      <ConnectRevenueDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        connections={connections}
        onConnected={(connection) =>
          setConnections((current) => [
            ...current.filter((row) => row.provider !== connection.provider),
            connection,
          ])
        }
        onDisconnected={(provider) =>
          setConnections((current) => current.filter((row) => row.provider !== provider))
        }
      />
    </ThemeProvider>
  );
}
