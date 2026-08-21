'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Building2,
  Command,
  Expand,
  Fish,
  Globe,
  HelpCircle,
  Moon,
  Palette,
  Play,
  Plug,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Sun,
  TreePine,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { type GardenState, type HistoricalSnapshot, type PlanTier, type Plant, type WeatherState } from './types';
import { getSeason, getGrowthStage, getHealthState, getTenureDays } from './lib/gardenUtils';
import { computeMetrics, mrrSeries } from './lib/metrics';
import { type MetricId, buildMetricCards, toMetricId } from './lib/metricPlants';
import { buildGardenPlanting } from './lib/gardenViews';
import { soundEngine } from './lib/soundEngine';
import { useTheme } from './lib/ThemeContext';
import { type Hotkey, useHotkeys } from './lib/useHotkeys';
import { useEventStream } from './lib/useEventStream';
import { EMPTY_URL_STATE, readUrlState, writeUrlState } from './lib/urlState';

import { ENABLED_SHAPES, type FocusTarget, IsometricGardenCanvas, type PlantShape } from './components/IsometricGardenCanvas';
import { RevenueModal } from './components/RevenueModal';
import { CommandPalette, type Command as PaletteCommand } from './components/CommandPalette';
import { GardenAdvisorDrawer } from './components/GardenAdvisorDrawer';
import { GlobalSubscriberGlobeModal } from './components/GlobalSubscriberGlobeModal';
import { PlantDetailDrawer } from './components/PlantDetailDrawer';
import { GuideModal } from './components/hud/GuideModal';
import { StatusBlock } from './components/hud/StatusBlock';
import { Toolbar, type Tool } from './components/hud/Toolbar';
import { Surface } from './components/hud/ui';
import { PlantingAnimation } from './components/hud/PlantingAnimation';
import { UnplantedBed } from './components/hud/UnplantedBed';
import { FilterPopover } from './components/hud/FilterPopover';
import { AppearancePopover } from './components/hud/AppearancePopover';
import { ActivityToasts, type Activity, type ActivityKind } from './components/hud/ActivityToasts';
import {
  isPlan,
  largestPlan,
  middlePlan,
  nextPlanUp,
  planBaseMrr,
  planNamesDescending,
  setPlanCatalogue,
  tierOfPlan,
} from './lib/plans';

/**
 * The plans a link is allowed to name in `?tier=`.
 *
 * The catalogue is the allow-list, so it is read at the moment the link is —
 * a plan the product has stopped selling, or one from a different product
 * entirely, lands on the whole book rather than on an empty plot.
 */

/**
 * Which of the optional HUD features are switched on.
 *
 * The same arrangement `ENABLED_SHAPES` uses for the city and the aquarium, and for
 * the same reason: a feature that is off has to be off *everywhere at once* —
 * toolbar button, ⌘K row and keyboard binding — because a key the guide advertises
 * and that does nothing when pressed is worse than no key, and a palette listing a
 * panel that cannot open is a dead end with a search hit.
 *
 * **Uncomment a line to bring one back.** Nothing else has been removed: the
 * advisor, the guide modal and the sound engine are all still here, wired and
 * working, waiting on this list.
 */
const ENABLED_FEATURES = [
  'filter',
  // 'appearance', // theme + season live behind the account cluster's palette
  //                  button now — one appearance setting, on every page.
  'globe',
  // 'search',    // the command palette     ·  ⌘K
  // 'revenue',   // the revenue panel       ·  R
  // 'advisor',   // the diagnostics drawer  ·  A
  // 'guide',     // how to read the garden  ·  ?
  // 'sound',     // the soundscape toggle   ·  M
] as const;

type Feature = 'search' | 'filter' | 'appearance' | 'revenue' | 'globe' | 'advisor' | 'guide' | 'sound';

const enabled = (feature: Feature): boolean =>
  (ENABLED_FEATURES as readonly string[]).includes(feature);

/**
 * A garden with nothing in it.
 *
 * The state the app now *starts* in, and the one it stays in until the server
 * sends a book. Every count is zero and every list is empty, because the
 * alternative — the generated business this file used to open on — meant the
 * first thing a signed-in user saw was customers who do not exist.
 */
const EMPTY_GARDEN: GardenState = {
  plants: [],
  tierPercentiles: {},
  // Kept at zero rather than removed: the synthetic long tail went with the
  // generator, and `meadowCount` is now a field that is always nought.
  meadowCount: 0,
  meadowHealth: 1,
  mrr: 0,
  activeCount: 0,
  atRiskCount: 0,
  totalCustomers: 0,
};

/**
 * The plot with nothing planted in it.
 *
 * Deliberately **not** an empty canvas: with no book there is no bed geometry, no
 * metric border and no timeline, and rendering the scene against zeroes would put
 * a $0 headline and a row of em dashes on screen — which reads as a broken
 * dashboard rather than as an account that has not connected anything yet. So the
 * plot is replaced, once, by the sentence that says what to do.
 *
 * It distinguishes the two ways of being empty, because they need different
 * sentences: nothing connected, or connected and working with no subscriptions in
 * the account.
 */
function EmptyPlot({
  book,
  onConnectRevenue,
  accountSlot,
  startupSlot,
  brandSlot,
  navSlot,
  transparent = false,
  adsSlot,
}: {
  book: { kind: 'loading' | 'live' | 'empty'; providers?: string[]; note?: string };
  onConnectRevenue?: () => void;
  accountSlot?: React.ReactNode;
  startupSlot?: React.ReactNode;
  brandSlot?: React.ReactNode;
  navSlot?: React.ReactNode;
  /** Paint nothing behind the scene — for frames that sit on a host surface. */
  transparent?: boolean;
  /** The sponsor strip — shown on the settled empty states, never while loading. */
  adsSlot?: React.ReactNode;
}) {
  const connected = (book.providers?.length ?? 0) > 0;
  const loading = book.kind === 'loading';

  return (
    <div
      className={`garden-root relative flex h-full w-full flex-col overflow-hidden text-ink font-sans ${
        transparent ? 'bg-transparent' : 'bg-page'
      }`}
    >
      {/*
        **Nothing but the animation while the book is being read.**

        The chrome is the same three bands the plot carries, and the *settled* empty
        states need it: those are screens a person stays on, and without navigation
        the only way off an unplanted garden was the account menu. Loading is not one
        of those screens — it is a second and a half of waiting for the page that is
        already on its way — and a wordmark, a nav pill and a startup switcher that
        arrive, sit still and then get replaced are three things that flicker for no
        answer. There is nothing to navigate to yet, and nothing to switch.
      */}
      {!loading && (
        <header className="pointer-events-none absolute inset-x-5 top-5 z-30 flex items-start justify-between gap-4">
          <div className="pointer-events-auto">{brandSlot}</div>

          <div className="pointer-events-auto absolute left-1/2 top-0 -translate-x-1/2">
            {navSlot}
          </div>

          <div className="pointer-events-auto flex items-center gap-1 rounded-[20px] bg-surface p-1.5 shadow-panel">
            {startupSlot}
            {startupSlot && accountSlot ? <span className="mx-1 h-5 w-px bg-hairline" /> : null}
            {accountSlot}
          </div>
        </header>
      )}

      {!loading && adsSlot}

      <main className="flex flex-1 items-center justify-center p-6">
        {/*
          Loading is its own scene rather than a card with a spinner on it: the bed
          is drawn and the trees come up on it, in the season's own colours, which
          says *what* is being waited for instead of only that something is.
        */}
        {loading ? (
          <div className="flex flex-col items-center text-center">
            <PlantingAnimation />
            <p className="mt-2 text-[15px] font-bold text-ink">Planting your garden…</p>
            <p className="mt-1 max-w-[34ch] text-[12.5px] text-ink-soft">
              Reading every connected provider for the subscriptions behind it.
            </p>
          </div>
        ) : (
        /*
          **The card is the picture, then the sentence.** And nothing else.

          It stands where the plot will, so it shows the plot's vocabulary before it
          explains it: a bed drawn in the season's own pigments, with the three things
          a subscription can become on it — a tree, an amber tree, a stump — named
          underneath. The copy under it is one line, and the button is the only thing
          on the card that is not the picture, which is what makes it the thing to
          press. An eyebrow chip, a provider strip and a second sentence were all
          tried here and all taken out: each was one more thing to read before the
          one thing to do.
        */
        <div className="w-full max-w-[460px] rounded-[20px] bg-surface-solid px-8 pb-8 pt-7 text-center shadow-panel ring-1 ring-hairline sm:px-10">
          <div className="mx-auto max-w-[360px]">
            <UnplantedBed variant={connected ? 'waiting' : 'legend'} />
          </div>

          {connected ? (
            <>
              <h2 className="mt-4 text-[22px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">
                Nothing to plant yet
              </h2>
              <p className="mx-auto mt-2 max-w-[38ch] text-[13.5px] leading-relaxed text-ink-soft">
                {book.note ??
                  `${book.providers!.join(' · ')} is connected and answering — it has no
                   subscriptions yet.`}{' '}
                The first one will come up here as a tree.
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-4 text-[22px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">
                Your garden is unplanted
              </h2>
              <p className="mx-auto mt-2 max-w-[38ch] text-[13.5px] leading-relaxed text-ink-soft">
                Connect where your money arrives and every subscription becomes a tree.
              </p>
            </>
          )}

          {onConnectRevenue && !connected && (
            <button
              type="button"
              onClick={onConnectRevenue}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-garden px-5 text-[13px] font-bold text-garden-ink transition-[background-color,transform] hover:bg-garden-hover active:scale-[0.98] cursor-pointer"
            >
              <Plug className="h-3.5 w-3.5" />
              Connect revenue
            </button>
          )}

          {connected && (
            /*
              Points at the startup's own settings rather than the imported-data page.
              This file cannot read the host app's `ENABLED_PAGES` — the garden is a
              self-contained port and importing `@/lib` here would break the
              standalone copy — so it links to the one place that is always there.
            */
            <a
              href="/dashboard/startups"
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-inset px-5 text-[13px] font-bold text-ink-soft transition-colors hover:text-ink"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Manage this startup&rsquo;s providers
            </a>
          )}
        </div>
        )}
      </main>
    </div>
  );
}

/**
 * The garden is the whole page, so the things that used to live in the app's
 * header — who is signed in, their notifications, the way out — have to live
 * in the plot's own toolbar. It arrives as a node because it is the host app's
 * concern: this file knows there is something to hang there and nothing about
 * what it contains.
 *
 * `onConnectRevenue` is the same arrangement in callback form, and it is now used
 * in **one** place: the empty plot's call to action. The toolbar pill, the `E`
 * binding and the palette row are gone, because connecting a provider is not a
 * thing you do while reading a plot that is already drawn — it happens when a
 * startup is created, in onboarding, or on that startup's settings page. A
 * permanent button for a once-per-business action was chrome competing with the
 * numbers it sat above.
 */
export default function App({
  accountSlot,
  startupSlot,
  brandSlot,
  navSlot,
  onConnectRevenue,
  onCleanView,
  clean = false,
  spectate = false,
  bookQuery,
  adsSlot,
}: {
  accountSlot?: React.ReactNode;
  /** The startup switcher — the host app's, like the account menu. */
  startupSlot?: React.ReactNode;
  /** The wordmark, top-left. */
  brandSlot?: React.ReactNode;
  /** The plot's three ways out, dead centre: it has no sidebar of its own. */
  navSlot?: React.ReactNode;
  onConnectRevenue?: () => void;
  /**
   * Wall-display mode: **the plot, and nothing on top of it.**
   *
   * The beds and the metric border are the whole reading — a tree is a
   * subscription at the size it pays, a specimen is a metric with its name and
   * value on a stake — so a screen showing them needs no HUD at all. Everything
   * that floats over the canvas is off: the header, the toolbar, the startup
   * switcher, the status block, the scrubber, the popovers, the drawers and the
   * activity toasts. Not hidden — not rendered.
   *
   * `computePlot` already solves for the scale that fits every bed, the border
   * and its labels inside the viewport, so full-bleed means the whole book is on
   * screen at the largest size it will go. That is the entire trick.
   */
  clean?: boolean;
  /**
   * The clean view for a *watcher* — somebody else's public forest in a frame
   * on an ordinary page. Same bare canvas as `clean`, with two differences:
   * the metric border stays a working menu (hover explains a specimen, a click
   * re-beds the plot as that metric — all client-side re-derivation of the
   * same book, so a spectator can read every planting without being able to
   * change anything real), and the painted atmosphere is off so the plot
   * stands on the page's own colour rather than inside a second background.
   * The wall display keeps its no-op border on purpose: a passer-by must not
   * leave a shared screen re-bedded.
   */
  spectate?: boolean;
  /**
   * Open the clean view. A callback rather than a route, for the reason
   * `onConnectRevenue` is one: this file is a self-contained port that knows
   * nothing about the host app's routing. Without it the button, the ⌘K row and
   * the `v` binding **do not exist**, which is the same rule `ENABLED_SHAPES`
   * applies to `c` — a key the guide advertises and that does nothing is worse
   * than no key.
   */
  onCleanView?: () => void;
  /**
   * Extra query string for the two book fetches — `startup=<id>` is how the
   * host app points this plot at somebody's *public* forest instead of the
   * session's own. A string rather than a route or an id, for the reason every
   * other host concern is a prop: this file knows nothing about the app around
   * it, including what the server accepts.
   */
  bookQuery?: string;
  /**
   * The host app's sponsor strip, rendered only once the live book is up: a
   * loading screen wearing ads is selling space on a page that is not there
   * yet, and the empty plot's one job is the connect call to action.
   */
  adsSlot?: React.ReactNode;
} = {}) {
  const { season: activeSeason, setAutoSeason, setMode, resolvedMode } = useTheme();

  // Everything shareable about the view is read out of the URL once, on mount,
  // so a link lands you where the sender was standing.
  const initialUrl = useMemo(() => (typeof window === 'undefined' ? EMPTY_URL_STATE : readUrlState()), []);

  /**
   * How the plot draws a subscription. Trees say what shape the business is;
   * the city stands the same book on one baseline, which is the only way to
   * rank two neighbours by eye; the aquarium says whether it is alive, and
   * draws payment volume as a school that grows as money arrives. None of them
   * is a different dataset — the beds and the sizes are identical.
   */
  const [plantShape, setPlantShape] = useState<PlantShape>(
    // A link can name a shape that is switched off, the same way it can name a
    // metric that does not exist: it lands on the garden rather than on nothing.
    ENABLED_SHAPES.includes(initialUrl.shape) ? initialUrl.shape : 'tree'
  );
  const nextShape = (current: PlantShape) =>
    ENABLED_SHAPES[(ENABLED_SHAPES.indexOf(current) + 1) % ENABLED_SHAPES.length];

  /**
   * **The plot starts empty and stays empty until the server sends a book.**
   *
   * It used to open on a generated business — `generateGarden(Date.now())` — which
   * meant the first frame anybody saw was invented customers, and a user with
   * nothing connected never saw anything else. There is no generator any more:
   * `lib/mockData` is deleted, and if the server has no subscriptions for this
   * user the plot says so instead of drawing somebody who does not exist.
   */
  const [liveGarden, setLiveGarden] = useState<GardenState>(EMPTY_GARDEN);
  const [snapshots, setSnapshots] = useState<HistoricalSnapshot[]>([]);

  const [scrubberIndex, setScrubberIndex] = useState<number>(() =>
    initialUrl.month !== null ? Math.max(0, initialUrl.month) : 0
  );

  /**
   * The timeline is a recording, not a treadmill.
   *
   * The scrubber's resting place is the right-hand end — today, on the live
   * MRR — and the only thing that ever moves it off there is a person: the play
   * button, the slider, the arrow keys. A playthrough sweeps the book once and
   * comes back to rest; it does not loop, and nothing starts it unasked.
   *
   * `isHeld` is what "and then it stops" means. It is stillness and *only*
   * stillness: the plot is standing on today with today's numbers, so there is
   * no month chip and no "back to today" to escape — the sweep has simply
   * finished and the scene has stopped moving. Touching the scrubber, playing
   * again or simulating an event starts it breathing.
   */
  const [isHeld, setIsHeld] = useState(false);
  const releaseHold = useCallback(() => setIsHeld(false), []);

  const isOffToday = scrubberIndex < snapshots.length - 1;

  /** Every deliberate move along the timeline ends the hold. */
  const scrubTo = useCallback(
    (index: number) => {
      releaseHold();
      setScrubberIndex(index);
    },
    [releaseHold]
  );

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState(initialUrl.query);
  const [selectedHealth, setSelectedHealth] = useState<string>(initialUrl.health ?? 'All');
  const [selectedStage, setSelectedStage] = useState<string>(initialUrl.stage ?? 'All');
  // A view is a link, so a link carrying a filter that no longer exists — the
  // long tail's `?tier=Meadow` — has to land on the whole book rather than on
  // an empty plot filtered by a plan nobody is on.
  const [selectedTier, setSelectedTier] = useState<PlanTier | 'All' | null>(() =>
    initialUrl.tier && isPlan(initialUrl.tier) ? initialUrl.tier : 'All'
  );


  const [isMuted, setIsMuted] = useState(true);

  // Modal & Drawer States
  const [isRevenueOpen, setIsRevenueOpen] = useState(false);
  /**
   * Which specimen in the border the plot is planted as. This is the whole
   * point of the border: it is a menu, and this is what it selects.
   */
  const [plantedMetric, setPlantedMetric] = useState<MetricId>(
    // A link can say anything; an unrecognised metric plants the beds as
    // revenue rather than as nothing at all.
    toMetricId(initialUrl.metric) ?? 'mrr'
  );
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isGlobeModalOpen, setIsGlobeModalOpen] = useState(false);
  /**
   * Bumped to re-read the book. The wall display does it on a timer; nothing
   * else touches it, so on a desk this stays 0 and the fetch below runs once,
   * exactly as it always did.
   */
  const [reloadKey, setReloadKey] = useState(0);
  /**
   * Whether there is a book at all.
   *
   * `loading` until the server answers, then `live` (their own subscriptions) or
   * `empty` with the reason. There is no third kind any more — the sample
   * business is gone — so this is no longer a label on the plot, it decides
   * whether there is a plot to draw.
   */
  const [book, setBook] = useState<{
    kind: 'loading' | 'live' | 'empty';
    /** Providers connected, when there are any. */
    providers?: string[];
    /** Why it is empty: nothing connected, or connected with no subscriptions. */
    note?: string;
  }>({ kind: 'loading' });
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Selection & camera
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(initialUrl.selected);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(
    initialUrl.selected ? { subscriptionId: initialUrl.selected, nonce: 0 } : null
  );

  const [activities, setActivities] = useState<Activity[]>([]);
  const transformRef = useRef<{ scale: number; centerX: number; centerY: number } | null>(null);

  const pushActivity = useCallback((kind: ActivityKind, label: string, subscriptionId?: string) => {
    setActivities((current) => [
      // Six at once is already a lot to read; drop the oldest beyond that.
      ...current.slice(-5),
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kind, label, subscriptionId, at: Date.now() },
    ]);
  }, []);

  const expireActivity = useCallback((id: string) => {
    setActivities((current) => current.filter((activity) => activity.id !== id));
  }, []);

  // Active Garden State (derived from scrubber or live)
  const activeGarden: GardenState = useMemo(() => {
    if (isOffToday && snapshots[scrubberIndex]) {
      const snap = snapshots[scrubberIndex];
      return {
        plants: snap.plants,
        tierPercentiles: liveGarden.tierPercentiles,
        meadowCount: snap.meadowCount,
        meadowHealth: 0.94,
        mrr: snap.mrr,
        activeCount: snap.activeCount,
        atRiskCount: snap.atRiskCount,
        totalCustomers: snap.activeCount,
      };
    }
    return liveGarden;
  }, [scrubberIndex, snapshots, liveGarden, isOffToday]);

  // Weather State
  const [weatherState, setWeatherState] = useState<WeatherState>({
    rainIntensity: 14,
    sunbeamPlantId: null,
    sunbeamAmount: null,
    cloudShadow: false,
    drought: false,
    season: 'summer',
    lastPaymentTime: Date.now(),
  });

  const currentSnapshot = snapshots[scrubberIndex] || snapshots[snapshots.length - 1];
  const currentSeason = useMemo(
    () => (currentSnapshot ? getSeason(currentSnapshot.month) : 'summer'),
    [currentSnapshot]
  );

  // The scrubber reports the month it is sitting in; the theme decides whether
  // to follow it or stay on a season the user pinned.
  useEffect(() => {
    setAutoSeason(currentSeason);
  }, [currentSeason, setAutoSeason]);

  const effectiveWeather = useMemo(
    () => ({ ...weatherState, season: activeSeason }),
    [weatherState, activeSeason]
  );

  // The numbers behind the month on screen. Cheap enough to keep live, because
  // the headline delta and sparkline read from it too.
  const metrics = useMemo(() => computeMetrics(snapshots, scrubberIndex), [snapshots, scrubberIndex]);
  const trend = useMemo(() => mrrSeries(snapshots, scrubberIndex, 12), [snapshots, scrubberIndex]);

  // Every metric the beds cannot show, as a specimen. They stand on the plot
  // itself in their own border, so retention and churn are read the same way
  // revenue is — by looking at the garden — rather than only behind a modal.
  const metricCards = useMemo(
    () => buildMetricCards(metrics, snapshots, scrubberIndex, activeGarden),
    [metrics, snapshots, scrubberIndex, activeGarden]
  );

  // How the beds are planted for the metric currently selected in the border.
  // Movement readings need last month as well as this one — without a previous
  // close there is nothing for a retention number to be a ratio of.
  const planting = useMemo(
    () =>
      buildGardenPlanting(
        plantedMetric,
        metrics,
        activeGarden.plants,
        scrubberIndex > 0 ? snapshots[scrubberIndex - 1]?.plants ?? null : null
      ),
    [plantedMetric, metrics, activeGarden.plants, snapshots, scrubberIndex]
  );

  const plantedCard = metricCards.find((card) => card.id === plantedMetric) ?? metricCards[0];

  // Looked up in the planting as well as in the book, because a movement
  // reading stands subscriptions on the plot that have already left it: a
  // churned tree you can click but not open would be a dead tree.
  const selectedPlant = useMemo(
    () =>
      activeGarden.plants.find((plant) => plant.subscription_id === selectedPlantId) ??
      planting.beds.flatMap((bed) => bed.plants).find((plant) => plant.subscription_id === selectedPlantId) ??
      null,
    [activeGarden, planting, selectedPlantId]
  );

  // Adopt the server's book on mount — both halves of it. Taking the garden
  // without the timeline would leave "today" describing the server's customers
  // and every earlier month describing ours.
  useEffect(() => {
    let cancelled = false;

    const suffix = bookQuery ? `?${bookQuery}` : '';
    Promise.all([
      fetch(`/api/garden${suffix}`).then((res) => res.json()),
      fetch(`/api/garden/history${suffix}`).then((res) => res.json()),
    ])
      .then(([state, history]) => {
        if (cancelled) return;

        // Nothing to plant. Said out loud rather than papered over with a
        // generated business, which is what used to happen here.
        if (!state?.gardenState || !history?.snapshots?.length) {
          setBook({
            kind: 'empty',
            providers: state?.providers ?? [],
            note: state?.note ?? undefined,
          });
          return;
        }

        // The server's ladder comes with the server's book. Adopting the
        // subscriptions without it would leave every one of them on a plan
        // this client has no rung for — drawn at the smallest size, in the
        // palest green, filtered by chips that name plans nobody is on.
        if (state.gardenState.planCatalogue) {
          try {
            setPlanCatalogue(state.gardenState.planCatalogue);
          } catch (error) {
            // Keep the local ladder rather than half-adopting one we cannot
            // read; the book below will simply be drawn against it.
            console.warn('Ignoring the server plan catalogue:', error);
          }
        }
        setLiveGarden(state.gardenState);
        setSnapshots(history.snapshots);
        setBook({ kind: 'live', providers: state.live?.providers ?? [] });
        // Adopting the server's book re-parks the scrubber at the end of it.
        // Clamping the old index instead would leave it standing in the middle
        // of a longer history — a month nobody asked for, on a stale MRR. A
        // link that names a month is the one thing that outranks today.
        setScrubberIndex((index) =>
          initialUrl.month !== null
            ? Math.min(index, history.snapshots.length - 1)
            : history.snapshots.length - 1
        );
        if (state.weatherState) setWeatherState((prev) => ({ ...prev, ...state.weatherState }));
      })
      .catch(() => {
        // The server could not be reached. There is no local book to fall back
        // on any more, so this is the empty plot with no reason to give.
        if (!cancelled) setBook({ kind: 'empty' });
      });

    return () => {
      cancelled = true;
    };
  }, [initialUrl.month, reloadKey, bookQuery]);

  /**
   * The wall display re-reads the book on its own, because nobody is going to
   * walk over and refresh it. Five minutes rather than five seconds: the
   * harvest behind `/api/garden` is itself cached for a minute per user, and a
   * board that hammers somebody's payment provider all day to redraw the same
   * forest is a bad neighbour. A month's revenue does not move in a second.
   */
  useEffect(() => {
    if (!clean) return;
    const timer = window.setInterval(() => setReloadKey((key) => key + 1), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [clean]);

  // The plot does not re-bed itself on a timer. It was tried: with no HUD to say
  // which metric is planted, a forest that rearranges every twenty seconds is a
  // screen doing something unexplained. The border is standing right there for
  // anyone who wants the other seven readings.

  /** Apply a subscription the server has told us about, in place. */
  const applyPlantUpdate = useCallback((plant: Plant) => {
    setLiveGarden((current) => {
      const index = current.plants.findIndex((p) => p.subscription_id === plant.subscription_id);
      if (index === -1) return current;
      const plants = [...current.plants];
      plants[index] = plant;
      const active = plants.filter((p) => p.status !== 'canceled');
      return {
        ...current,
        plants,
        activeCount: active.length,
        atRiskCount: active.filter((p) => p.failed_attempts > 0).length,
        mrr: active.reduce((total, p) => total + p.mrr, 0),
      };
    });
  }, []);

  // Everything the server broadcasts now lands here, so two people looking at
  // the same garden see the same garden.
  const streamStatus = useEventStream({
    onPayment: (event) => {
      pushActivity('paid', `Paid $${event.amount}`, event.subscription_id);
    },
    onPlantUpdate: (plant, kind) => {
      applyPlantUpdate(plant);
      const label =
        kind === 'recovery' ? 'Recovered' : kind === 'upgrade' ? 'Upgraded' : kind === 'churn' ? 'Churned' : 'Payment failed';
      const activityKind: ActivityKind =
        kind === 'recovery' ? 'recovered' : kind === 'upgrade' ? 'upgraded' : kind === 'churn' ? 'churned' : 'failed';
      pushActivity(activityKind, label, plant.subscription_id);
    },
    onPlantCreated: (plant) => {
      setLiveGarden((current) => ({
        ...current,
        plants: [plant, ...current.plants],
        activeCount: current.activeCount + 1,
        mrr: current.mrr + plant.mrr,
      }));
      pushActivity('paid', 'New subscription', plant.subscription_id);
    },
    onWeather: (event) => {
      if (event.type === 'sunbeam') {
        setWeatherState((w) => ({ ...w, sunbeamPlantId: event.plantId ?? null, sunbeamAmount: 2400 }));
      } else if (event.type === 'sunbeam_clear') {
        setWeatherState((w) => ({ ...w, sunbeamPlantId: null, sunbeamAmount: null }));
      }
    },
  });

  // One entry per plan the product sells, dearest first — a plan with nobody
  // on it still gets its chip reading (0), because "nobody is on Enterprise"
  // is a reading and a chip silently missing from the row is not.
  const tierCounts = useMemo(() => {
    const counts: Record<PlanTier, number> = {};
    planNamesDescending().forEach((plan) => {
      counts[plan] = 0;
    });
    activeGarden.plants.forEach((p) => {
      if (counts[p.plan] !== undefined) counts[p.plan]++;
    });
    return counts;
  }, [activeGarden]);

  // Compute matching plant counts for the filter panel
  const matchingPlantsCount = useMemo(() => {
    const now = Date.now();
    const query = searchQuery.trim().toLowerCase();
    return activeGarden.plants.filter((plant) => {
      const stage = getGrowthStage(getTenureDays(plant.started, now));
      const health = getHealthState(plant, now);

      const matchesSearch =
        !query ||
        plant.customer_name.toLowerCase().includes(query) ||
        plant.subscription_id.toLowerCase().includes(query) ||
        plant.plan.toLowerCase().includes(query) ||
        !!plant.countryName?.toLowerCase().includes(query) ||
        !!plant.countryCode?.toLowerCase().includes(query) ||
        !!plant.region?.toLowerCase().includes(query);

      return (
        matchesSearch &&
        (selectedHealth === 'All' || health === selectedHealth) &&
        (selectedStage === 'All' || stage === selectedStage)
      );
    }).length;
  }, [activeGarden, searchQuery, selectedHealth, selectedStage]);

  /**
   * **There is no simulator any more.**
   *
   * `handleSimulateWebhook` and the five per-plant triggers used to POST at
   * `/api/garden/simulate-event`, which mutated a shared *generated* book, and
   * fell back to editing this client's copy when the request failed. Both halves
   * went with the sample data: on a plot that is somebody's real revenue, a
   * button that invents a payment is a button that lies about their business.
   * Real movement arrives the only honest way it can — from the provider, in the
   * next harvest.
   */

  /**
   * The soundscape toggle.
   *
   * Worth knowing if `'sound'` is ever switched back on: since the simulator was
   * removed, nothing in the app calls `soundEngine.play*` any more — the chimes
   * were fired by invented payments. The engine and this toggle are intact, so
   * re-enabling the button gives back a control over silence until something real
   * (a provider event on the stream) is wired to play through it.
   */
  const handleToggleSound = () => setIsMuted(!soundEngine.toggleMute());

  /** Select a plant *and* take the camera to it. */
  const inspectPlant = useCallback((plant: Plant) => {
    setSelectedPlantId(plant.subscription_id);
    // Carries a nonce so asking for the same plant twice flies to it twice.
    setFocusTarget((current) => ({
      subscriptionId: plant.subscription_id,
      nonce: (current?.nonce ?? 0) + 1,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedTier('All');
    setSelectedHealth('All');
    setSelectedStage('All');
    setSearchQuery('');
  }, []);

  // Time-lapse across the whole timeline.
  const playTimelineRef = useRef<number | null>(null);
  const handlePlayYear = useCallback(() => {
    if (playTimelineRef.current !== null) {
      window.clearInterval(playTimelineRef.current);
      playTimelineRef.current = null;
      setIsPlaying(false);
      return;
    }

    releaseHold();
    setIsPlaying(true);
    let step = 0;
    playTimelineRef.current = window.setInterval(() => {
      setScrubberIndex(step);
      step++;
      if (step >= snapshots.length) {
        window.clearInterval(playTimelineRef.current!);
        playTimelineRef.current = null;
        setIsPlaying(false);
        // One pass, and then it stands still on today. The sweep is over; it
        // does not start again, and it does not wander off the end.
        setIsHeld(true);
      }
    }, 400);
  }, [releaseHold, snapshots.length]);

  useEffect(() => () => {
    if (playTimelineRef.current !== null) window.clearInterval(playTimelineRef.current);
  }, []);

  const scrubBy = useCallback(
    (delta: number) => {
      releaseHold();
      setScrubberIndex((index) => Math.max(0, Math.min(snapshots.length - 1, index + delta)));
    },
    [releaseHold, snapshots.length]
  );

  const returnToToday = useCallback(() => {
    releaseHold();
    setScrubberIndex(snapshots.length - 1);
  }, [releaseHold, snapshots.length]);

  const closeOverlays = useCallback(() => {
    setIsPaletteOpen(false);
    setIsFilterOpen(false);
    setIsAppearanceOpen(false);
    setIsRevenueOpen(false);
    setIsAdvisorOpen(false);
    setIsGlobeModalOpen(false);
    setShowGuideModal(false);
    setSelectedPlantId(null);
  }, []);

  /** The month the headline delta is measured against. */
  const previousLabel = useMemo(() => {
    const previous = snapshots[scrubberIndex - 1];
    if (!previous) return null;
    return `${new Date(previous.year, previous.month, 1).toLocaleString('default', {
      month: 'short',
    })} ${previous.year}`;
  }, [snapshots, scrubberIndex]);

  const monthLabel = currentSnapshot
    ? `${new Date(currentSnapshot.year, currentSnapshot.month, 1)
        .toLocaleString('default', { month: 'short' })
        .toUpperCase()} ${currentSnapshot.year}`
    : 'TODAY';

  const activeFilters = [
    selectedTier && selectedTier !== 'All' ? String(selectedTier) : null,
    selectedHealth !== 'All' ? selectedHealth : null,
    selectedStage !== 'All' ? selectedStage : null,
    searchQuery.trim() ? `“${searchQuery.trim()}”` : null,
  ].filter(Boolean) as string[];

  // Keep the address bar describing the view. Replace, never push: scrubbing a
  // timeline should not bury the back button under three years of months.
  useEffect(() => {
    writeUrlState({
      metric: plantedMetric,
      shape: plantShape,
      month: isOffToday ? scrubberIndex : null,
      tier: selectedTier === null ? null : String(selectedTier),
      health: selectedHealth,
      stage: selectedStage,
      query: searchQuery,
      selected: selectedPlantId,
    });
  }, [plantedMetric, plantShape, isOffToday, scrubberIndex, selectedTier, selectedHealth, selectedStage, searchQuery, selectedPlantId]);

  /**
   * Every keyboard binding in the app, in one list. The guide renders it and
   * the palette advertises it, so the three can never disagree.
   */
  const hotkeys: Hotkey[] = useMemo(
    () => [
      ...(enabled('search')
        ? [{
            combo: 'mod+k',
            label: 'Find a customer or run a command',
            group: 'General',
            allowInInput: true,
            run: () => setIsPaletteOpen((open) => !open),
          }]
        : []),
      { combo: '/', label: 'Search and filter', group: 'General', run: () => setIsFilterOpen((open) => !open) },
      ...(enabled('revenue')
        ? [{ combo: 'r', label: 'Revenue', group: 'Panels', run: () => setIsRevenueOpen((open) => !open) }]
        : []),
      ...(enabled('advisor')
        ? [{ combo: 'a', label: 'Garden advisor', group: 'Panels', run: () => setIsAdvisorOpen((open) => !open) }]
        : []),
      ...(enabled('guide')
        ? [{ combo: '?', label: 'This guide', group: 'Panels', run: () => setShowGuideModal((open) => !open) }]
        : []),
      { combo: 'd', label: 'Light or dark', group: 'View', run: () => setMode(resolvedMode === 'dark' ? 'light' : 'dark') },
      ...(onCleanView
        ? [{ combo: 'v', label: 'Clean view — the plot on its own', group: 'View', run: onCleanView }]
        : []),
      // Only while there is something to switch between. A binding that the
      // guide and the palette both advertise, and that does nothing when
      // pressed, is worse than no binding.
      ...(ENABLED_SHAPES.length > 1
        ? [{
            combo: 'c',
            label: 'Trees, city or aquarium',
            group: 'View',
            run: () => setPlantShape(nextShape),
          }]
        : []),
      ...(enabled('sound')
        ? [{ combo: 'm', label: 'Mute the soundscape', group: 'View', run: handleToggleSound }]
        : []),
      { combo: 'ArrowLeft', label: 'Previous month', group: 'Time', run: () => scrubBy(-1) },
      { combo: 'ArrowRight', label: 'Next month', group: 'Time', run: () => scrubBy(1) },
      { combo: ' ', label: 'Play the timeline', group: 'Time', run: handlePlayYear },
      {
        combo: 't',
        label: 'Back to today',
        group: 'Time',
        run: returnToToday,
      },
      { combo: 'Escape', label: 'Close everything', group: 'General', allowInInput: true, run: closeOverlays },
    ],
    [closeOverlays, handlePlayYear, onCleanView, onConnectRevenue, resolvedMode, returnToToday, scrubBy, setMode]
  );

  useHotkeys(hotkeys);

  /** The palette's own list: the shortcuts, plus the things that have no key. */
  const paletteCommands: PaletteCommand[] = [
      ...(enabled('revenue')
        ? [{ id: 'revenue', label: 'Revenue', hint: 'MRR movement, retention, cohorts', group: 'Panels', icon: BarChart3, combo: 'r', run: () => setIsRevenueOpen(true) }]
        : []),
      ...(enabled('advisor')
        ? [{ id: 'advisor', label: 'Garden advisor', group: 'Panels', icon: Sparkles, combo: 'a', run: () => setIsAdvisorOpen(true) }]
        : []),
      { id: 'globe-modal', label: 'Subscribers around the world', group: 'Panels', icon: Globe, run: () => setIsGlobeModalOpen(true) },
      ...(enabled('guide')
        ? [{ id: 'guide', label: 'How to read the garden', group: 'Panels', icon: HelpCircle, combo: '?', run: () => setShowGuideModal(true) }]
        : []),

      { id: 'filter', label: 'Search and filter', group: 'View', icon: SlidersHorizontal, combo: '/', run: () => setIsFilterOpen(true) },
      ...(enabled('appearance')
        ? [{ id: 'appearance', label: 'Appearance and season', group: 'View', icon: Palette, run: () => setIsAppearanceOpen(true) }]
        : []),
      // One row per shape rather than a cycle, because a palette is a list of
      // places you can go, not a button you press three times. Empties itself
      // when the other shapes are switched off.
      ...ENABLED_SHAPES.filter((id) => id !== plantShape).map((id) => ({
        id: `shape-${id}`,
        label:
          id === 'tree'
            ? 'Draw the plot as trees'
            : id === 'city'
            ? 'Draw the plot as a city'
            : 'Draw the plot as an aquarium',
        hint:
          id === 'tree'
            ? 'The garden — what shape the business is'
            : id === 'city'
            ? 'Towers on one baseline, easier to rank'
            : 'Fish, and payments as a school that grows',
        group: 'View',
        icon: id === 'tree' ? TreePine : id === 'city' ? Building2 : Fish,
        combo: 'c',
        run: () => setPlantShape(id),
      })),
      {
        id: 'mode',
        label: resolvedMode === 'dark' ? 'Switch to light' : 'Switch to dark',
        group: 'View',
        icon: resolvedMode === 'dark' ? Sun : Moon,
        combo: 'd',
        run: () => setMode(resolvedMode === 'dark' ? 'light' : 'dark'),
      },
      ...(onCleanView
        ? [{
            id: 'clean',
            label: 'Clean view',
            hint: 'The plot and the metric border, with the chrome taken away',
            group: 'View',
            icon: Expand,
            combo: 'v',
            run: onCleanView,
          }]
        : []),
      ...(enabled('sound')
        ? [{ id: 'sound', label: isMuted ? 'Unmute the soundscape' : 'Mute the soundscape', group: 'View', icon: isMuted ? Volume2 : VolumeX, combo: 'm', run: handleToggleSound }]
        : []),
      ...(activeFilters.length
        ? [{ id: 'clear', label: 'Clear all filters', hint: activeFilters.join(' · '), group: 'View', icon: Search, run: clearFilters }]
        : []),

      // The border bed is a menu you click; this is the same menu for people
      // who drive by keyboard, and it keeps the plantings discoverable.
      ...metricCards.map((card) => ({
        id: `plant-${card.id}`,
        label: `Plant the garden as ${card.label.toLowerCase()}`,
        hint: `${card.value} · ${card.hint}`,
        group: 'Plant',
        icon: Sprout,
        run: () => setPlantedMetric(card.id),
      })),

      { id: 'play', label: 'Play the timeline', group: 'Time', icon: Play, combo: ' ', run: handlePlayYear },
      ...(isOffToday
        ? [{ id: 'today', label: 'Back to today', hint: `Currently ${monthLabel}`, group: 'Time', icon: Command, combo: 't', run: returnToToday }]
        : []),

  ];

  const tools: Tool[] = [
    ...(enabled('search')
      ? [{
          id: 'search',
          icon: Search,
          label: 'Find a customer (⌘K)',
          onClick: () => setIsPaletteOpen(true),
          group: 'find' as Tool['group'],
        }]
      : []),
    {
      id: 'filter',
      icon: SlidersHorizontal,
      label: 'Search and filter',
      onClick: () => {
        setIsAppearanceOpen(false);
        setIsFilterOpen((open) => !open);
      },
      tone: isFilterOpen || activeFilters.length ? 'active' : 'plain',
      badge: activeFilters.length || undefined,
      group: 'find',
    },
    ...(enabled('appearance')
      ? [{
          id: 'appearance',
          icon: Palette,
          label: 'Appearance and season',
          onClick: () => {
            setIsFilterOpen(false);
            setIsAppearanceOpen((open) => !open);
          },
          tone: isAppearanceOpen ? ('active' as const) : ('plain' as const),
          group: 'view' as const,
        }]
      : []),
    /*
      The clean view, in the `view` group beside the palette button. It is the
      one tool that takes the chrome *away* rather than putting something over
      the plot, so it belongs next to the control that decides how the plot
      looks rather than among the panels that open on top of it.
    */
    ...(onCleanView
      ? [{
          id: 'clean',
          icon: Expand,
          label: 'Clean view — the plot on its own',
          onClick: onCleanView,
          group: 'view' as Tool['group'],
        }]
      : []),
    /*
      Play, up here with the view controls rather than on the scrubber: set the
      plot up the way you want it, then press this and watch the year sweep
      through it. The scrubber below stays for picking a month by hand.
    */
    {
      id: 'play',
      icon: Play,
      label: isPlaying ? 'Playing the year…' : 'Play the year',
      onClick: handlePlayYear,
      tone: isPlaying ? ('active' as const) : ('plain' as const),
      group: 'view' as Tool['group'],
    },
    ...(enabled('revenue')
      ? [{
          id: 'revenue',
          icon: BarChart3,
          label: 'Revenue',
          onClick: () => setIsRevenueOpen(true),
          group: 'read' as Tool['group'],
        }]
      : []),
    ...(enabled('advisor')
      ? [{ id: 'advisor', icon: Sparkles, label: 'Garden advisor', onClick: () => setIsAdvisorOpen(true) }]
      : []),
    ...(enabled('guide')
      ? [{ id: 'guide', icon: HelpCircle, label: 'How to read the garden', onClick: () => setShowGuideModal(true) }]
      : []),
    ...(enabled('sound')
      ? [{
          id: 'sound',
          icon: isMuted ? VolumeX : Volume2,
          label: isMuted ? 'Unmute soundscape' : 'Mute soundscape',
          onClick: handleToggleSound,
          tone: (isMuted ? 'plain' : 'active') as Tool['tone'],
        }]
      : []),
  ];

  const overlays = (
    <>
      {enabled('search') && (
        <CommandPalette
          open={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
          commands={paletteCommands}
          plants={activeGarden.plants}
          onSelectPlant={inspectPlant}
        />
      )}

      {enabled('revenue') && (
        <RevenueModal
          isOpen={isRevenueOpen}
          onClose={() => setIsRevenueOpen(false)}
          focusMetric={plantedMetric}
          snapshots={snapshots}
          activeIndex={scrubberIndex}
          onScrub={scrubTo}
          gardenState={activeGarden}
          onInspectPlant={(plant) => {
            setIsRevenueOpen(false);
            inspectPlant(plant);
          }}
        />
      )}

      {enabled('advisor') && (
        <GardenAdvisorDrawer
          isOpen={isAdvisorOpen}
          onClose={() => setIsAdvisorOpen(false)}
          gardenState={activeGarden}
          weatherState={effectiveWeather}
        />
      )}

      <GlobalSubscriberGlobeModal
        isOpen={isGlobeModalOpen}
        onClose={() => setIsGlobeModalOpen(false)}
        gardenState={activeGarden}
        onSelectPlantFromGlobe={inspectPlant}
      />

      <PlantDetailDrawer
        plant={selectedPlant}
        onClose={() => setSelectedPlantId(null)}
      />

      {enabled('guide') && (
        <GuideModal isOpen={showGuideModal} onClose={() => setShowGuideModal(false)} hotkeys={hotkeys} />
      )}
    </>
  );

  /*
    Nothing to draw. Every hook above has run — they are unconditional, and the
    empty book is exactly what they were made safe for — but there are no beds to
    lay out, no metric border to score and no months to scrub, so the scene is
    replaced by the sentence that says what to do about it rather than rendered
    against zeroes.
  */
  if (book.kind !== 'live') {
    return (
      <EmptyPlot
        book={book}
        onConnectRevenue={onConnectRevenue}
        accountSlot={accountSlot}
        startupSlot={startupSlot}
        brandSlot={brandSlot}
        navSlot={navSlot}
        transparent={spectate}
        adsSlot={spectate ? undefined : adsSlot}
      />
    );
  }

  /*
    The wall display.

    Same canvas, same beds, same sizes — the plot is not a different drawing
    here, it is the same one with the room's furniture taken away. What changes
    is everything a hand would have touched: no header, no toolbar, no startup
    switcher, no scrubber, no popovers, no drawers, and no plant selection, so a
    passer-by cannot leave it filtered, scrubbed to March, or with a drawer open
    over the trees. `onSelectPlant` is not wired at all rather than being wired
    to nothing, so the canvas does not draw a hover state a nobody can act on.
  */
  if (clean || spectate) {
    return (
      // The wall display owns its whole screen, so it paints the page colour;
      // a spectator frame sits inside somebody else's surface — a white card
      // on the board — and paints nothing, so the forest stands on whatever
      // the host put it on.
      <div
        className={`garden-root relative h-full w-full overflow-hidden text-ink font-sans select-none ${
          spectate ? "bg-transparent" : "bg-page"
        }`}
      >
        <main className="absolute inset-0">
          <IsometricGardenCanvas
            gardenState={activeGarden}
            weatherState={effectiveWeather}
            selectedTier={selectedTier}
            // Required, so it is a no-op rather than absent — but it never
            // stores anything, which is what keeps a drawer off the wall.
            onSelectPlant={() => {}}
            selectedPlant={null}
            planting={planting}
            metricCards={metricCards}
            selectedMetric={plantedMetric}
            // A watcher may re-bed the plot — it is the same book, re-derived
            // in their own browser. The wall display may not; see `spectate`.
            onSelectMetric={spectate ? setPlantedMetric : undefined}
            plainBackground={spectate}
            shape={plantShape}
            still={isHeld}
            currentTimeMs={Date.now()}
            searchQuery={searchQuery}
            selectedHealth={selectedHealth}
            selectedStage={selectedStage}
            focusTarget={focusTarget}
            transformRef={transformRef}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="garden-root relative h-full w-full overflow-hidden bg-page text-ink font-sans select-none flex flex-col">
      {/*
        HUD, in three bands. The top row is chrome — who you are, which business,
        where else you can go — and it is deliberately the *quietest* thing on the
        screen. The reading sits below it, and the plot is behind both.
      */}
      <header className="pointer-events-none absolute inset-x-5 top-5 z-30 flex items-start justify-between gap-4">
        <div className="pointer-events-auto">{brandSlot}</div>

        {/*
          Centred on the *viewport*, not on what is left between the wordmark and
          the toolbar. With `justify-between` doing the placing, this pill drifted
          whenever the account name or the startup name changed length — and a
          control that moves when your data changes is one you have to look for
          twice. The header is already the containing block, so this is absolute
          against it.
        */}
        <div className="pointer-events-auto absolute left-1/2 top-0 -translate-x-1/2">
          {navSlot}
        </div>

        <Toolbar tools={tools} account={accountSlot}>
          {enabled('appearance') && (
            <AppearancePopover open={isAppearanceOpen} onClose={() => setIsAppearanceOpen(false)} />
          )}

          <FilterPopover
            open={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedTier={selectedTier}
            onSelectTier={setSelectedTier}
            tierCounts={tierCounts}
            selectedHealth={selectedHealth}
            onHealthSelect={setSelectedHealth}
            selectedStage={selectedStage}
            onStageSelect={setSelectedStage}
            matchingCount={matchingPlantsCount}
            totalCount={activeGarden.plants.length}
          />
        </Toolbar>
      </header>

      {/*
        The left column: which business, then what it is worth.

        The switcher sat in the toolbar with the tools, where it read as a sixth
        control. It belongs above the number instead, because it is the *subject* of
        every figure underneath it — the heading of the column, not another button.
      */}
      <div className="absolute left-5 top-[92px] z-30 flex flex-col items-start gap-2">
        {/*
          `relative z-20`, and it is not decoration: `Surface` carries
          `backdrop-blur-xl`, and a backdrop-filter creates a **stacking context**.
          That means the switcher's popover — `z-50` inside this pill — was scoped
          to this pill, while the status card below is another such context later in
          the tree, so it painted over the open menu and choosing a second startup
          meant clicking on a list you could not see. Lifting the pill itself is
          what puts everything inside it above the number.
        */}
        {startupSlot ? (
          <Surface className="pointer-events-auto relative z-20 p-1.5">{startupSlot}</Surface>
        ) : null}

        <StatusBlock
          mrr={activeGarden.mrr}
          activeCount={activeGarden.activeCount}
          atRiskCount={activeGarden.atRiskCount}
          trend={trend}
          momGrowth={metrics.momGrowth}
          weather={effectiveWeather}
          historyLabel={isOffToday ? monthLabel : null}
          onReturnToToday={returnToToday}
          filterSummary={
            activeFilters.length
              ? activeFilters.length === 1
                ? activeFilters[0]
                : `${activeFilters.length} filters`
              : null
          }
          onClearFilters={clearFilters}
          streamStatus={streamStatus}
          previousLabel={previousLabel}
          onOpenRevenue={() => setIsRevenueOpen(true)}
          planted={
            plantedMetric === 'mrr' || !plantedCard
              ? null
              : {
                  label: plantedCard.label,
                  value: plantedCard.value,
                  caption: plantedCard.reading,
                  emptyNote: planting.emptyNote,
                  onReset: () => setPlantedMetric('mrr'),
                }
          }
        />

        {/*
          The timeline, shown only while it means something: pressing Play slides
          this in under the reading so the sweep can be watched month by month —
          and it stays if you stop somewhere in the past, because a rail you can
          see is also the way back. At rest on today it is not there at all.
        */}
        {(isPlaying || isOffToday) && snapshots.length > 1 && (
          <Surface className="pointer-events-auto flex w-[300px] items-center gap-2.5 px-3.5 py-2">
            <span className="w-[74px] shrink-0 text-[12px] font-bold tabular-nums text-ink">
              {monthLabel}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(0, snapshots.length - 1)}
              value={scrubberIndex}
              onChange={(event) => scrubTo(Number(event.target.value))}
              aria-label="Month"
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-track accent-garden outline-none"
            />
          </Surface>
        )}
      </div>

      {/* Main Isometric Canvas */}
      <main className="flex-1 w-full h-full relative">
        <IsometricGardenCanvas
          gardenState={activeGarden}
          weatherState={effectiveWeather}
          selectedTier={selectedTier}
          // The plot stands on the page itself: no painted sky, no drifting
          // seasonal air, no sun wash — in any season. The scene is the trees.
          plainBackground
          onSelectPlant={(plant) => setSelectedPlantId(plant?.subscription_id ?? null)}
          selectedPlant={selectedPlant}
          planting={planting}
          metricCards={metricCards}
          selectedMetric={plantedMetric}
          onSelectMetric={setPlantedMetric}
          shape={plantShape}
          still={isHeld}
          currentTimeMs={Date.now()}
          searchQuery={searchQuery}
          selectedHealth={selectedHealth}
          selectedStage={selectedStage}
          focusTarget={focusTarget}
          transformRef={transformRef}
        />

        <ActivityToasts
          activities={activities}
          planting={planting}
          transformRef={transformRef}
          onExpire={expireActivity}
        />
      </main>

      {/*
        The scrubber bar is gone: the toolbar's Play button is how history is
        watched now, and it always comes back to rest on today. `?m=` links and
        `scrubTo` remain wired, so a shared month still lands — there is just no
        permanent bar for a control most visits never touched. `ControlBar` is
        intact if it is ever wanted back.
      */}
      {adsSlot}

      {overlays}
    </div>
  );
}
