import React from 'react';
import { AlertTriangle, BarChart3, Download, X } from 'lucide-react';
import { type GardenState, type HistoricalSnapshot, type Plant } from '../types';
import {
  type CohortRow,
  cohortRetention,
  computeMetrics,
  dunningWorklist,
  mrrSeries,
  planBreakdown,
} from '../lib/metrics';
import { type MetricCard, type MetricId, buildMetricCards } from '../lib/metricPlants';
import { count, money, percent, tenureLabel } from '../lib/format';
import { getTenureDays } from '../lib/gardenUtils';
import { Sparkline } from './charts/Sparkline';
import { TrendChart } from './charts/TrendChart';
import { MovementChart } from './charts/MovementChart';
import { RetentionGrid } from './charts/RetentionGrid';
import { backdropProps, cx, useEscapeToClose } from './hud/ui';

/**
 * The numbers behind the garden.
 *
 * The plot is a wonderful qualitative instrument — you can see a bed going
 * yellow from across the room — and a hopeless quantitative one. Nobody can
 * look at two hundred trees and tell you net revenue retention. This panel is
 * the other half: the same book of business, read as the six or seven figures
 * an operator actually opens a dashboard for.
 *
 * It reads whatever month the timeline is scrubbed to, so the panel and the
 * plot are never describing different points in time, and the trend chart
 * scrubs the timeline back — closing the panel leaves you standing in the month
 * you were investigating.
 */

type Tab = 'overview' | 'retention' | 'accounts' | 'dunning';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'retention', label: 'Retention' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'dunning', label: 'At risk' },
];

interface RevenueModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The specimen that sent you here, if a plant in the border was clicked. */
  focusMetric?: MetricId | null;
  snapshots: HistoricalSnapshot[];
  activeIndex: number;
  onScrub: (index: number) => void;
  gardenState: GardenState;
  /** Close the panel and walk the camera to a plant. */
  onInspectPlant: (plant: Plant) => void;
}

const deltaClass = (tone: 'good' | 'bad' | 'flat' = 'flat') =>
  cx(
    tone === 'good' && 'text-garden-soft',
    tone === 'bad' && 'text-danger-ink',
    tone === 'flat' && 'text-ink-faint'
  );

/**
 * Which band the specimen on the plot is standing in, as a colour.
 *
 * The plants themselves live in the garden now — this rail is the figures. But
 * a reader moving between the two has to be able to match them up, so each row
 * keeps the same three-band judgement its specimen is painted with.
 */
const bandClass = (health: number) =>
  health >= 0.66 ? 'bg-garden' : health >= 0.33 ? 'bg-warn' : 'bg-danger';

/**
 * One metric in the rail: its number, and the band its plant is in.
 *
 * The specimens used to stand here. They stand in the garden's metric border
 * instead — a plant is worth drawing at the size of a tree, not a favicon —
 * and this column is what it should have been all along: the figures, exact,
 * in a list you can run your eye down. Picking one promotes it to the panel
 * beside.
 */
const MetricRailCard: React.FC<{
  card: MetricCard;
  selected: boolean;
  onSelect: () => void;
}> = ({ card, selected, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={cx(
      'flex w-full items-center gap-2.5 rounded-2xl border px-2.5 py-2 text-left transition-colors cursor-pointer',
      selected
        ? 'border-garden-line bg-garden-wash'
        : 'border-hairline bg-inset hover:bg-inset-strong'
    )}
  >
    <span
      aria-hidden
      className={cx('h-8 w-1 shrink-0 rounded-full', bandClass(card.spec.health))}
    />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[10px] font-bold uppercase tracking-[0.06em] text-ink-faint">
        {card.label}
      </span>
      <span className="block text-[16px] font-extrabold leading-tight tracking-tight text-ink">
        {card.value}
      </span>
      <span className="block truncate text-[10px] font-semibold">
        {card.delta ? <span className={deltaClass(card.deltaTone)}>{card.delta} </span> : null}
        <span className="font-medium text-ink-faint">{card.hint}</span>
      </span>
    </span>
  </button>
);

export const RevenueModal: React.FC<RevenueModalProps> = ({
  isOpen,
  onClose,
  focusMetric,
  snapshots,
  activeIndex,
  onScrub,
  gardenState,
  onInspectPlant,
}) => {
  const [tab, setTab] = React.useState<Tab>('overview');
  const [retentionMode, setRetentionMode] = React.useState<'revenue' | 'logos'>('revenue');
  const [selectedMetric, setSelectedMetric] = React.useState<MetricId>('mrr');

  useEscapeToClose(isOpen, onClose);

  // Clicking a specimen in the garden opens the panel standing on that metric,
  // so the plant you asked about is the number you get.
  React.useEffect(() => {
    if (!isOpen || !focusMetric) return;
    setSelectedMetric(focusMetric);
    setTab('overview');
  }, [isOpen, focusMetric]);

  const metrics = React.useMemo(
    () => (isOpen ? computeMetrics(snapshots, activeIndex) : null),
    [isOpen, snapshots, activeIndex]
  );

  // The triangle is the expensive one — three years of cohorts against three
  // years of months — so it is built only when its tab is actually looking.
  const cohorts: CohortRow[] = React.useMemo(
    () => (isOpen && tab === 'retention' ? cohortRetention(snapshots, activeIndex, retentionMode) : []),
    [isOpen, tab, snapshots, activeIndex, retentionMode]
  );

  const worklist = React.useMemo(
    () => (isOpen ? dunningWorklist(gardenState.plants) : []),
    [isOpen, gardenState]
  );

  if (!isOpen || !metrics) return null;

  const trend = mrrSeries(snapshots, activeIndex, 12);
  const activePlants = gardenState.plants.filter((plant) => plant.status !== 'canceled');
  const bookMrr = activePlants.reduce((total, plant) => total + plant.mrr, 0);
  const topAccounts = [...activePlants].sort((a, b) => b.mrr - a.mrr).slice(0, 12);
  const byPlan = planBreakdown(gardenState.plants);
  const atRiskMrr = worklist.reduce((total, plant) => total + plant.mrr, 0);

  const cards: MetricCard[] = buildMetricCards(metrics, snapshots, activeIndex, gardenState);
  const selectedCard = cards.find((card) => card.id === selectedMetric) ?? cards[0];

  /**
   * Closed means **not mounted**, not merely invisible.
   *
   * Everything above this line is a hook, so the guard sits here rather than at the
   * top of the component — but it has to exist: the panel's root is a
   * `fixed inset-0 z-50` scrim, and a scrim that is always in the tree is an
   * invisible sheet over the whole product. Every click in the app landed on it and
   * did nothing, including the toolbar, the timeline and the plot itself.
   *
   * `metrics` is deliberately `null` while closed — that is the work-skipping the
   * `isOpen` checks above are for — which is also why this cannot move any earlier
   * without those memos losing their guard.
   */
  if (!isOpen || !metrics) return null;

  const exportCsv = () => {
    const headers = [
      'subscription_id', 'customer', 'plan', 'mrr', 'status', 'failed_attempts',
      'cohort', 'started', 'tenure_days', 'country', 'plan_changes',
    ];
    const rows = gardenState.plants.map((plant) => [
      plant.subscription_id,
      `"${plant.customer_name.replace(/"/g, '""')}"`,
      plant.plan,
      plant.mrr,
      plant.status,
      plant.failed_attempts,
      plant.cohort,
      new Date(plant.started).toISOString().slice(0, 10),
      Math.floor(getTenureDays(plant.started)),
      plant.countryCode ?? '',
      plant.changes?.length ?? 0,
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `allotment-${metrics.month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4 backdrop-blur-[2px]"
      {...backdropProps(onClose)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Revenue"
        className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-[20px] border border-hairline bg-surface-solid p-5 text-ink shadow-modal"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline pb-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-2xl border border-garden-line bg-garden-wash text-garden-soft">
              <BarChart3 className="h-[18px] w-[18px]" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold tracking-tight text-ink">Revenue</h2>
              <p className="text-[12px] text-ink-faint">
                {metrics.label} · {count(metrics.activeCount)} subscribers · {money(metrics.mrr)} MRR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center gap-1.5 rounded-2xl px-2.5 py-1.5 text-[12px] font-semibold text-ink-soft transition-colors hover:bg-inset hover:text-ink cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-xl text-ink-faint transition-colors hover:bg-inset hover:text-ink cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex shrink-0 gap-1.5">
          {TABS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTab(option.id)}
              aria-pressed={tab === option.id}
              className={cx(
                'rounded-2xl px-3 py-1.5 text-[12px] font-bold transition-colors cursor-pointer',
                tab === option.id ? 'bg-garden text-garden-ink' : 'bg-inset text-ink-soft hover:bg-inset-strong'
              )}
            >
              {option.label}
              {option.id === 'dunning' && worklist.length > 0 ? (
                <span className={cx('ml-1.5 tabular-nums', tab === option.id ? 'opacity-70' : 'text-warn-ink')}>
                  {worklist.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          {tab === 'overview' && (
            <div className="flex flex-col-reverse gap-4 lg:flex-row">
              {/* The selected metric, at a size worth looking at. */}
              <section className="min-w-0 flex-1">
                <div className="flex items-start gap-4 rounded-[20px] border border-hairline bg-inset p-4">
                  <span
                    aria-hidden
                    className={cx('mt-1 w-1 shrink-0 self-stretch rounded-full', bandClass(selectedCard.spec.health))}
                  />

                  <div className="min-w-0 flex-1">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-faint">
                      {selectedCard.label}
                    </h3>
                    <div className="mt-1 flex items-end gap-2.5">
                      <span className="text-[40px] font-extrabold leading-none tracking-tight text-ink">
                        {selectedCard.value}
                      </span>
                      {selectedCard.id === 'mrr' && trend.length > 1 && (
                        <span className="pb-1.5">
                          <Sparkline values={trend} label={`MRR over the last ${trend.length} months`} />
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[12px] font-semibold">
                      {selectedCard.delta ? (
                        <span className={deltaClass(selectedCard.deltaTone)}>{selectedCard.delta} </span>
                      ) : null}
                      <span className="font-medium text-ink-faint">{selectedCard.hint}</span>
                    </p>

                    <p className="mt-3 text-[12px] leading-relaxed text-ink-soft">{selectedCard.reading}</p>
                    <p className="mt-1.5 text-[11px] text-ink-faint">{selectedCard.benchmark}</p>
                    <p className="mt-1.5 text-[11px] text-ink-faint">
                      Pick its specimen in the garden’s metric border to plant the whole plot as this
                      reading.
                    </p>
                  </div>
                </div>

                {/* The chart that belongs to whichever metric is showing. */}
                {selectedCard.chart === 'trend' && (
                  <div className="mt-4">
                    <h3 className="text-[12px] font-bold text-ink">Monthly recurring revenue</h3>
                    <p className="text-[11px] text-ink-faint">Click the plot to scrub the garden to that month.</p>
                    <div className="mt-1">
                      <TrendChart snapshots={snapshots} activeIndex={activeIndex} onScrub={onScrub} />
                    </div>
                  </div>
                )}

                {selectedCard.chart === 'movement' && (
                  <div className="mt-4">
                    <h3 className="text-[12px] font-bold text-ink">How {metrics.label} moved</h3>
                    {metrics.movement ? (
                      <div className="mt-1">
                        <MovementChart movement={metrics.movement} />
                      </div>
                    ) : (
                      <p className="mt-2 text-[12px] text-ink-faint">
                        This is the first month on record — there is no previous close to move from.
                      </p>
                    )}
                  </div>
                )}

                {selectedCard.chart === 'plans' && (
                  <div className="mt-4">
                    <h3 className="text-[12px] font-bold text-ink">Revenue by plan</h3>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {byPlan.map((row) => (
                        <div key={row.plan} className="flex items-center gap-3">
                          <span className="w-20 shrink-0 text-[11px] font-bold text-ink-soft">{row.plan}</span>
                          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-inset-strong">
                            <span
                              className="block h-full rounded-full bg-garden"
                              style={{ width: `${bookMrr > 0 ? (row.mrr / bookMrr) * 100 : 0}%` }}
                            />
                          </span>
                          <span className="w-24 shrink-0 text-right text-[11px] font-bold tabular-nums text-ink">
                            {money(row.mrr)}
                          </span>
                          <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-ink-faint">
                            {count(row.count)} subs
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* The bed: every metric as a specimen, one per row. */}
              <nav
                aria-label="Metrics"
                className="flex shrink-0 gap-1.5 overflow-x-auto pb-1 lg:w-[228px] lg:flex-col lg:overflow-x-visible lg:pb-0"
              >
                {cards.map((card) => (
                  <div key={card.id} className="w-[196px] shrink-0 lg:w-auto">
                    <MetricRailCard
                      card={card}
                      selected={card.id === selectedMetric}
                      onSelect={() => setSelectedMetric(card.id)}
                    />
                  </div>
                ))}
              </nav>
            </div>
          )}

          {tab === 'retention' && (
            <RetentionGrid rows={cohorts} mode={retentionMode} onModeChange={setRetentionMode} />
          )}

          {tab === 'accounts' && (
            <div className="flex flex-col gap-4">
              <section>
                <h3 className="text-[12px] font-bold text-ink">Revenue by plan</h3>
                <div className="mt-2 flex flex-col gap-1.5">
                  {byPlan.map((row) => (
                    <div key={row.plan} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-[11px] font-bold text-ink-soft">{row.plan}</span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-inset">
                        <span
                          className="block h-full rounded-full bg-garden"
                          style={{ width: `${bookMrr > 0 ? (row.mrr / bookMrr) * 100 : 0}%` }}
                        />
                      </span>
                      <span className="w-24 shrink-0 text-right text-[11px] font-bold tabular-nums text-ink">
                        {money(row.mrr)}
                      </span>
                      <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-ink-faint">
                        {count(row.count)} subs
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border-t border-hairline pt-3">
                <h3 className="text-[12px] font-bold text-ink">Largest accounts</h3>
                <p className="text-[11px] text-ink-faint">
                  The top ten carry {percent(metrics.top10Concentration, 0)} of revenue. Select one to find it in
                  the garden.
                </p>
                <div className="mt-2 flex flex-col gap-1">
                  {topAccounts.map((plant) => (
                    <button
                      key={plant.subscription_id}
                      type="button"
                      onClick={() => onInspectPlant(plant)}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-inset px-2.5 py-2 text-left transition-colors hover:bg-inset-strong cursor-pointer"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-garden text-[10px] font-bold text-garden-ink">
                          {plant.customer_name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-bold text-ink">
                            {plant.countryFlag ? `${plant.countryFlag} ` : ''}
                            {plant.customer_name}
                          </span>
                          <span className="block text-[10px] text-ink-faint">
                            {plant.plan} · {tenureLabel(getTenureDays(plant.started))} · cohort {plant.cohort}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[12px] font-bold tabular-nums text-ink">{money(plant.mrr)}</span>
                        <span className="block text-[10px] tabular-nums text-ink-faint">
                          {percent(bookMrr > 0 ? plant.mrr / bookMrr : 0, 1)} of book
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === 'dunning' && (
            <div className="flex flex-col gap-2">
              {worklist.length === 0 ? (
                <p className="rounded-2xl border border-garden-line bg-garden-wash p-6 text-center text-[12px] font-semibold text-garden-soft">
                  Every subscription is paying. Nothing is in dunning.
                </p>
              ) : (
                <>
                  <p className="text-[11px] text-ink-faint">
                    {count(worklist.length)} subscriptions worth {money(atRiskMrr)} a month are failing to charge,
                    worst first — a large account on its first retry outranks a small one on its last.
                  </p>
                  {worklist.map((plant) => (
                    <div
                      key={plant.subscription_id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-warn-line bg-warn-wash px-2.5 py-2"
                    >
                      <button
                        type="button"
                        onClick={() => onInspectPlant(plant)}
                        className="flex min-w-0 items-center gap-2 text-left cursor-pointer"
                      >
                        <AlertTriangle className="h-4 w-4 shrink-0 text-warn-ink" />
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-bold text-ink">
                            {plant.customer_name}
                          </span>
                          <span className="block text-[10px] font-semibold text-warn-ink">
                            {plant.failed_attempts} failed {plant.failed_attempts === 1 ? 'attempt' : 'attempts'} ·{' '}
                            {plant.plan}
                          </span>
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[12px] font-bold tabular-nums text-ink">{money(plant.mrr)}/mo</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
