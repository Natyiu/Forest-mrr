import React from 'react';
import { History, Sprout, TrendingDown, TrendingUp, X } from 'lucide-react';
import { WeatherState } from '../../types';
import { SEASON_LABELS } from '../../lib/theme';
import { signedPercent } from '../../lib/format';
import { StreamStatus } from '../../lib/useEventStream';
import { Sparkline } from '../charts/Sparkline';
import { cx } from './ui';

/**
 * Everything that is *status* rather than *control*, in one place, top-left.
 *
 * Revenue, headcount, weather and "you are looking at the past" were four
 * separate floating cards. None of them is a control, so none of them needs a
 * card — they read as one paragraph of numbers over the garden.
 *
 * That paragraph has exactly three bands, and they are ranked: the **headline**
 * (what the plot is showing), one **meta line** of everything standing behind it
 * at a single quiet weight, and **chips** for the temporary states you can undo.
 * Anything that grew a colour, an icon and a font size of its own — the weather,
 * the season, the four saturated pills — was competing with the headline for
 * attention it had not earned. Colour here now means one thing only: something
 * needs looking at.
 */

interface StatusBlockProps {
  mrr: number;
  activeCount: number;
  atRiskCount: number;
  /** MRR for the trailing twelve months, oldest first. */
  trend: number[];
  /** Change against last month, as a ratio. Null in the first month on record. */
  momGrowth: number | null;
  weather: WeatherState;
  historyLabel: string | null;
  onReturnToToday: () => void;
  filterSummary: string | null;
  onClearFilters: () => void;
  streamStatus: StreamStatus;
  /** Opens the revenue panel — the headline number is a way in, not just a read-out. */
  onOpenRevenue: () => void;
  /**
   * The metric the beds are planted as, when it is not revenue.
   *
   * The headline has to be the thing the plot is showing. A plot bedded by net
   * retention under a big MRR figure is two claims at once, and a reader will
   * believe the number.
   */
  planted: {
    label: string;
    value: string;
    /** How to read the planting, in a sentence. */
    caption: string;
    /** Why the plot is bare, when it is. */
    emptyNote: string | null;
    onReset: () => void;
  } | null;
}

/** How busy the garden is, in three words. Only a drought is worth a colour. */
function weatherLine(weather: WeatherState) {
  if (weather.drought) return { text: 'Drought', urgent: true };
  if (weather.rainIntensity > 0) return { text: `${weather.rainIntensity} payments/hr`, urgent: false };
  return { text: 'Quiet', urgent: false };
}

const STREAM_TITLES: Record<StreamStatus, string> = {
  live: 'Connected to the event stream',
  connecting: 'Connecting to the event stream',
  offline: 'Offline — showing the last known garden',
};

const STREAM_DOTS: Record<StreamStatus, string> = {
  live: 'bg-accent',
  connecting: 'bg-warn',
  offline: 'bg-ink-faint',
};

/**
 * One shape for every undoable state. Three pills in three different fills read
 * as three unrelated alarms; one shape, one weight, and the reader can see at a
 * glance that they are all the same kind of thing — a thing you can put back.
 */
const Chip: React.FC<{
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}> = ({ icon: Icon, children, onClick, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="flex h-7 items-center gap-1.5 rounded-full border border-hairline bg-surface pl-2.5 pr-2 text-[12px] font-semibold text-ink-soft shadow-panel backdrop-blur-md transition-colors hover:bg-inset hover:text-ink cursor-pointer"
  >
    {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
    {children}
    <X className="h-3 w-3 text-ink-faint" />
  </button>
);

export const StatusBlock: React.FC<StatusBlockProps> = ({
  mrr,
  activeCount,
  atRiskCount,
  trend,
  momGrowth,
  weather,
  historyLabel,
  onReturnToToday,
  filterSummary,
  onClearFilters,
  streamStatus,
  onOpenRevenue,
  planted,
}) => {
  const busy = weatherLine(weather);
  const rising = momGrowth !== null && momGrowth >= 0;
  const DeltaIcon = rising ? TrendingUp : TrendingDown;

  return (
    <div className="pointer-events-auto max-w-[min(46ch,50vw)] select-none">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
        {planted ? planted.label : 'Monthly revenue'}
        {/* Whether the numbers are arriving on their own, said quietly. */}
        <span
          title={STREAM_TITLES[streamStatus]}
          className={cx('h-1.5 w-1.5 rounded-full', STREAM_DOTS[streamStatus])}
        />
        <span className="sr-only">
          {streamStatus === 'live' ? 'Live' : streamStatus === 'connecting' ? 'Connecting' : 'Offline'}
        </span>
      </div>

      {/* The headline is the door to the numbers behind it. */}
      <button
        type="button"
        onClick={onOpenRevenue}
        title="Open the revenue panel"
        className="mt-1 flex items-end gap-3 rounded-xl text-left transition-opacity hover:opacity-80 cursor-pointer"
      >
        <span className="text-[54px] font-extrabold leading-[1] tracking-[-0.035em] text-ink">
          {planted ? planted.value : `$${mrr.toLocaleString()}`}
        </span>

        {/* The delta and the sparkline are revenue's, and only revenue's. */}
        {!planted && (
          <span className="flex flex-col gap-1 pb-2">
            {momGrowth !== null && (
              <span
                className={cx(
                  'flex items-center gap-1 text-[12px] font-bold tabular-nums',
                  rising ? 'text-accent-soft' : 'text-danger-ink'
                )}
              >
                <DeltaIcon className="h-3.5 w-3.5" />
                {signedPercent(momGrowth)}
              </span>
            )}
            {trend.length > 1 && (
              <Sparkline values={trend} label={`Revenue over the last ${trend.length} months`} />
            )}
          </span>
        )}
      </button>

      {/*
        One line for everything standing behind the headline. Separated by
        middots rather than by four colours and two icons: only the count that
        wants action keeps a colour.
      */}
      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] font-medium text-ink-faint">
        <span className="font-semibold text-ink-soft tabular-nums">{activeCount.toLocaleString()} active</span>
        {atRiskCount > 0 && (
          <>
            <span aria-hidden>·</span>
            <span className="font-semibold text-warn-ink tabular-nums">{atRiskCount} at risk</span>
          </>
        )}
        <span aria-hidden>·</span>
        <span className={cx('tabular-nums', busy.urgent && 'font-semibold text-warn-ink')}>{busy.text}</span>
        <span aria-hidden>·</span>
        <span>{SEASON_LABELS[weather.season]}</span>
      </div>

      {/* How to read the planting on the plot, when it is not the obvious one. */}
      {planted && (
        <p className="mt-2 text-[12.5px] leading-snug text-ink-soft">
          {planted.emptyNote ?? planted.caption}
        </p>
      )}

      {/* Context chips — only present when they are true. */}
      {(historyLabel || filterSummary || planted) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {/* The eyebrow already names the planting; this only has to undo it. */}
          {planted && (
            <Chip icon={Sprout} onClick={planted.onReset} title="Plant the garden as revenue again">
              Back to revenue
            </Chip>
          )}

          {historyLabel && (
            <Chip icon={History} onClick={onReturnToToday} title="Back to today">
              {historyLabel}
            </Chip>
          )}

          {filterSummary && (
            <Chip onClick={onClearFilters} title="Clear all filters">
              {filterSummary}
            </Chip>
          )}
        </div>
      )}
    </div>
  );
};
