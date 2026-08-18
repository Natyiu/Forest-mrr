import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Building2,
  Command,
  Fish,
  Globe,
  HelpCircle,
  Moon,
  Palette,
  Play,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Sun,
  TreePine,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { GardenState, HistoricalSnapshot, PlanTier, Plant, WeatherState } from './types';
import { generateGarden } from './lib/mockData';
import { getSeason, getGrowthStage, getHealthState, getTenureDays } from './lib/gardenUtils';
import { computeMetrics, mrrSeries } from './lib/metrics';
import { MetricId, buildMetricCards, toMetricId } from './lib/metricPlants';
import { buildGardenPlanting } from './lib/gardenViews';
import { MEADOW_ARPA } from './lib/gardenUtils';
import { soundEngine } from './lib/soundEngine';
import { useTheme } from './lib/ThemeContext';
import { Hotkey, useHotkeys } from './lib/useHotkeys';
import { useEventStream } from './lib/useEventStream';
import { EMPTY_URL_STATE, readUrlState, writeUrlState } from './lib/urlState';

import { ENABLED_SHAPES, FocusTarget, IsometricGardenCanvas, PlantShape } from './components/IsometricGardenCanvas';
import { RevenueModal } from './components/RevenueModal';
import { CommandPalette, Command as PaletteCommand } from './components/CommandPalette';
import { GardenAdvisorDrawer } from './components/GardenAdvisorDrawer';
import { GlobalSubscriberGlobeModal } from './components/GlobalSubscriberGlobeModal';
import { StripeSimulatorModal } from './components/StripeSimulatorModal';
import { PlantDetailDrawer } from './components/PlantDetailDrawer';
import { GuideModal } from './components/hud/GuideModal';
import { StatusBlock } from './components/hud/StatusBlock';
import { Toolbar, Tool } from './components/hud/Toolbar';
import { ControlBar } from './components/hud/ControlBar';
import { FilterPopover } from './components/hud/FilterPopover';
import { AppearancePopover } from './components/hud/AppearancePopover';
import { ActivityToasts, Activity, ActivityKind } from './components/hud/ActivityToasts';
import { isPlan, largestPlan, planNamesDescending, setPlanCatalogue } from './lib/plans';

/**
 * The plans a link is allowed to name in `?tier=`.
 *
 * The catalogue is the allow-list, so it is read at the moment the link is —
 * a plan the product has stopped selling, or one from a different product
 * entirely, lands on the whole book rather than on an empty plot.
 */

export default function App() {
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

  // One book of business, sampled at many dates: the live garden *is* the last
  // month of the timeline rather than a separate roll of the dice.
  const [{ garden: initialGarden, snapshots: initialSnapshots }] = useState(() => generateGarden(Date.now()));
  const [liveGarden, setLiveGarden] = useState<GardenState>(initialGarden);
  const [snapshots, setSnapshots] = useState<HistoricalSnapshot[]>(initialSnapshots);

  const [scrubberIndex, setScrubberIndex] = useState<number>(() =>
    initialUrl.month !== null ? Math.min(initialUrl.month, initialSnapshots.length - 1) : initialSnapshots.length - 1
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
  const [isStripeModalOpen, setIsStripeModalOpen] = useState(false);
  const [stripeApiKey, setStripeApiKey] = useState('');
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

    Promise.all([
      fetch('/api/garden').then((res) => res.json()),
      fetch('/api/garden/history').then((res) => res.json()),
    ])
      .then(([state, history]) => {
        if (cancelled || !state?.gardenState || !history?.snapshots?.length) return;
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
        // No server behind us: the book generated on the client stands.
      });

    return () => {
      cancelled = true;
    };
  }, [initialUrl.month]);

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
        activeCount: active.length + current.meadowCount,
        atRiskCount: active.filter((p) => p.failed_attempts > 0).length,
        mrr: active.reduce((total, p) => total + p.mrr, 0) + current.meadowCount * MEADOW_ARPA,
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

  // Handle Event Triggers
  const handleSimulateWebhook = (type: string, data: any) => {
    // Asking the business to do something is asking to watch it happen, so a
    // simulated event drops the hold. The hold sits on the last month, so
    // letting go of it is already standing on today.
    releaseHold();

    if (type === 'payment' || type === 'invoice.payment_succeeded') {
      soundEngine.playPaymentChime();
    } else if (type === 'sunbeam') {
      soundEngine.playWhaleSunbeam();
    } else if (type === 'invoice.payment_failed') {
      soundEngine.playDunningFail();
    }

    fetch('/api/simulate-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data }),
    })
      .then((res) => res.json())
      .then((resData) => {
        // The stream carries the narration; the response carries the truth.
        if (resData.gardenState) setLiveGarden(resData.gardenState);
        if (resData.weatherState) setWeatherState((prev) => ({ ...prev, ...resData.weatherState }));
      })
      .catch(() => {
        // Local simulation fallback, for when there is no server behind us.
        if (type === 'payment' || type === 'invoice.payment_succeeded') {
          pushActivity('paid', data?.amount ? `Paid $${data.amount}` : 'Payment received', data?.subscription_id);
          setWeatherState((w) => ({
            ...w,
            rainIntensity: Math.min(40, w.rainIntensity + 6),
            lastPaymentTime: Date.now(),
            drought: false,
          }));
        } else if (type === 'sunbeam') {
          pushActivity('whale', 'Whale payment', data?.subscription_id);
          setWeatherState((w) => ({
            ...w,
            sunbeamPlantId:
              data?.subscription_id ??
              activeGarden.plants.find((p) => p.plan === largestPlan())?.subscription_id ??
              null,
            sunbeamAmount: 1200,
          }));
        } else if (type === 'invoice.payment_failed') {
          pushActivity('failed', 'Payment failed', data?.subscription_id);
          setLiveGarden((prev) => {
            const plants = prev.plants.map((p) =>
              p.subscription_id === data?.subscription_id || !data?.subscription_id
                ? { ...p, status: 'past_due' as const, failed_attempts: Math.min(3, p.failed_attempts + 1) }
                : p
            );
            return { ...prev, plants, atRiskCount: plants.filter((p) => p.failed_attempts > 0).length };
          });
        } else if (type === 'recovery') {
          pushActivity('recovered', 'Recovered', data?.subscription_id);
          setLiveGarden((prev) => {
            const plants = prev.plants.map((p) =>
              p.status === 'past_due' ? { ...p, status: 'active' as const, failed_attempts: 0 } : p
            );
            return { ...prev, plants, atRiskCount: 0 };
          });
        }
      });
  };

  const handleTriggerPayment = (plant: Plant) =>
    handleSimulateWebhook('payment', {
      subscription_id: plant.subscription_id,
      customer_name: plant.customer_name,
      plan: plant.plan,
      amount: plant.mrr,
    });

  const handleTriggerFail = (plant: Plant) =>
    handleSimulateWebhook('invoice.payment_failed', {
      subscription_id: plant.subscription_id,
      customer_name: plant.customer_name,
    });

  const handleTriggerRecover = (plant: Plant) =>
    handleSimulateWebhook('recovery', {
      subscription_id: plant.subscription_id,
      customer_name: plant.customer_name,
    });

  const handleTriggerUpgrade = (plant: Plant) =>
    handleSimulateWebhook('customer.subscription.updated', {
      type: 'upgrade',
      subscription_id: plant.subscription_id,
      customer_name: plant.customer_name,
    });

  const handleTriggerChurn = (plant: Plant) =>
    handleSimulateWebhook('customer.subscription.deleted', {
      subscription_id: plant.subscription_id,
      customer_name: plant.customer_name,
    });

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
    setIsStripeModalOpen(false);
    setShowGuideModal(false);
    setSelectedPlantId(null);
  }, []);

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
      {
        combo: 'mod+k',
        label: 'Find a customer or run a command',
        group: 'General',
        allowInInput: true,
        run: () => setIsPaletteOpen((open) => !open),
      },
      { combo: '/', label: 'Search and filter', group: 'General', run: () => setIsFilterOpen((open) => !open) },
      { combo: 'r', label: 'Revenue', group: 'Panels', run: () => setIsRevenueOpen((open) => !open) },
      { combo: 'a', label: 'Garden advisor', group: 'Panels', run: () => setIsAdvisorOpen((open) => !open) },
      { combo: 'e', label: 'Stripe events', group: 'Panels', run: () => setIsStripeModalOpen((open) => !open) },
      { combo: '?', label: 'This guide', group: 'Panels', run: () => setShowGuideModal((open) => !open) },
      { combo: 'd', label: 'Light or dark', group: 'View', run: () => setMode(resolvedMode === 'dark' ? 'light' : 'dark') },
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
      { combo: 'm', label: 'Mute the soundscape', group: 'View', run: handleToggleSound },
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
    [closeOverlays, handlePlayYear, resolvedMode, returnToToday, scrubBy, setMode]
  );

  useHotkeys(hotkeys);

  /** The palette's own list: the shortcuts, plus the things that have no key. */
  const paletteCommands: PaletteCommand[] = [
      { id: 'revenue', label: 'Revenue', hint: 'MRR movement, retention, cohorts', group: 'Panels', icon: BarChart3, combo: 'r', run: () => setIsRevenueOpen(true) },
      { id: 'advisor', label: 'Garden advisor', group: 'Panels', icon: Sparkles, combo: 'a', run: () => setIsAdvisorOpen(true) },
      { id: 'events', label: 'Stripe events', hint: 'Simulate a webhook', group: 'Panels', icon: Zap, combo: 'e', run: () => setIsStripeModalOpen(true) },
      { id: 'globe-modal', label: 'Subscribers around the world', group: 'Panels', icon: Globe, run: () => setIsGlobeModalOpen(true) },
      { id: 'guide', label: 'How to read the garden', group: 'Panels', icon: HelpCircle, combo: '?', run: () => setShowGuideModal(true) },

      { id: 'filter', label: 'Search and filter', group: 'View', icon: SlidersHorizontal, combo: '/', run: () => setIsFilterOpen(true) },
      { id: 'appearance', label: 'Appearance and season', group: 'View', icon: Palette, run: () => setIsAppearanceOpen(true) },
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
      { id: 'sound', label: isMuted ? 'Unmute the soundscape' : 'Mute the soundscape', group: 'View', icon: isMuted ? Volume2 : VolumeX, combo: 'm', run: handleToggleSound },
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

      { id: 'pay', label: 'Simulate a payment', group: 'Simulate', icon: Zap, run: () => handleSimulateWebhook('payment', {}) },
      { id: 'whale', label: 'Simulate a whale payment', group: 'Simulate', icon: Sparkles, run: () => handleSimulateWebhook('sunbeam', {}) },
      { id: 'fail', label: 'Simulate a failed payment', group: 'Simulate', icon: Zap, run: () => handleSimulateWebhook('invoice.payment_failed', {}) },
      { id: 'recover', label: 'Simulate a recovery', group: 'Simulate', icon: Zap, run: () => handleSimulateWebhook('recovery', {}) },
  ];

  const tools: Tool[] = [
    {
      id: 'search',
      icon: Search,
      label: 'Find a customer (⌘K)',
      onClick: () => setIsPaletteOpen(true),
    },
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
    },
    {
      id: 'appearance',
      icon: Palette,
      label: 'Appearance and season',
      onClick: () => {
        setIsFilterOpen(false);
        setIsAppearanceOpen((open) => !open);
      },
      tone: isAppearanceOpen ? 'active' : 'plain',
    },
    { id: 'revenue', icon: BarChart3, label: 'Revenue', onClick: () => setIsRevenueOpen(true) },
    { id: 'advisor', icon: Sparkles, label: 'Garden advisor', onClick: () => setIsAdvisorOpen(true) },
    { id: 'guide', icon: HelpCircle, label: 'How to read the garden', onClick: () => setShowGuideModal(true) },
    {
      id: 'sound',
      icon: isMuted ? VolumeX : Volume2,
      label: isMuted ? 'Unmute soundscape' : 'Mute soundscape',
      onClick: handleToggleSound,
      tone: isMuted ? 'plain' : 'active',
    },
  ];

  const overlays = (
    <>
      <CommandPalette
        open={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        commands={paletteCommands}
        plants={activeGarden.plants}
        onSelectPlant={inspectPlant}
      />

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
        onRecover={handleTriggerRecover}
      />

      <GardenAdvisorDrawer
        isOpen={isAdvisorOpen}
        onClose={() => setIsAdvisorOpen(false)}
        gardenState={activeGarden}
        weatherState={effectiveWeather}
        onTriggerPaymentRain={() => handleSimulateWebhook('payment', {})}
        onTriggerWhalePayment={() => handleSimulateWebhook('sunbeam', {})}
        onTriggerDunningFailure={() => handleSimulateWebhook('invoice.payment_failed', {})}
        onTriggerRecovery={() => handleSimulateWebhook('recovery', {})}
      />

      <GlobalSubscriberGlobeModal
        isOpen={isGlobeModalOpen}
        onClose={() => setIsGlobeModalOpen(false)}
        gardenState={activeGarden}
        onSelectPlantFromGlobe={inspectPlant}
      />

      <StripeSimulatorModal
        isOpen={isStripeModalOpen}
        onClose={() => setIsStripeModalOpen(false)}
        onSimulateWebhook={handleSimulateWebhook}
        stripeApiKey={stripeApiKey}
        onSaveStripeKey={(key) => {
          setStripeApiKey(key);
          setIsStripeModalOpen(false);
        }}
      />

      <PlantDetailDrawer
        plant={selectedPlant}
        onClose={() => setSelectedPlantId(null)}
        onTriggerPayment={handleTriggerPayment}
        onTriggerFail={handleTriggerFail}
        onTriggerRecover={handleTriggerRecover}
        onUpgrade={handleTriggerUpgrade}
        onChurn={handleTriggerChurn}
      />

      <GuideModal isOpen={showGuideModal} onClose={() => setShowGuideModal(false)} hotkeys={hotkeys} />
    </>
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-page text-ink font-sans select-none flex flex-col">
      {/* HUD — three surfaces: status, tools, controls. Everything else is summoned. */}
      <header className="pointer-events-none absolute inset-x-5 top-5 z-30 flex items-start justify-between gap-4">
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

        <Toolbar
          tools={tools}
          primary={{ icon: Zap, label: 'Stripe Events', onClick: () => setIsStripeModalOpen(true) }}
        >
          <AppearancePopover open={isAppearanceOpen} onClose={() => setIsAppearanceOpen(false)} />

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

      {/* Main Isometric Canvas */}
      <main className="flex-1 w-full h-full relative">
        <IsometricGardenCanvas
          gardenState={activeGarden}
          weatherState={effectiveWeather}
          selectedTier={selectedTier}
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

      <ControlBar
        monthLabel={monthLabel}
        index={scrubberIndex}
        total={snapshots.length}
        onScrub={scrubTo}
        onPlay={handlePlayYear}
        isPlaying={isPlaying}
        shape={plantShape}
        onShapeChange={setPlantShape}
      />

      {overlays}
    </div>
  );
}
