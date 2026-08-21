import React from 'react';
import { History, Sprout, TrendingDown, TrendingUp, X } from 'lucide-react';
import { type WeatherState } from '../../types';
import { signedPercent } from '../../lib/format';
import { type StreamStatus } from '../../lib/useEventStream';
import { Sparkline } from '../charts/Sparkline';
import { Surface, cx } from './ui';

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
  /**
   * The month the delta is measured against — "vs. Jul 2026".
   *
   * A percentage with nothing to compare it to is a number a reader has to take
   * on trust; naming the month is the difference between "up 12%" and "up 12% on
   * what".
   */
  previousLabel: string | null;
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
  /**
   * Lay the reading out as one wide band instead of a tall corner card — the
   * arrangement the plot uses now that it sits under the number rather than
   * beside it. Same facts, same chips, same door to the revenue panel; only
   * the geometry changes.
   */
  horizontal?: boolean;
  /** A slot at the band's far end — the startup switcher, in practice. */
  trailing?: React.ReactNode;
}

const STREAM_TITLES: Record<StreamStatus, string> = {
  live: 'Connected to the event stream',
  connecting: 'Connecting to the event stream',
  offline: 'Offline — showing the last known garden',
};

const STREAM_DOTS: Record<StreamStatus, string> = {
  live: 'bg-garden',
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
  previousLabel,
  onOpenRevenue,
  planted,
  horizontal = false,
  trailing,
}) => {
  const rising = momGrowth !== null && momGrowth >= 0;
  const DeltaIcon = rising ? TrendingUp : TrendingDown;

  if (horizontal) {
    return (
      <Surface className="pointer-events-auto w-full select-none px-6 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
              {planted ? planted.label : 'Monthly revenue'}
              <span
                title={STREAM_TITLES[streamStatus]}
                className={cx('h-1.5 w-1.5 rounded-full', STREAM_DOTS[streamStatus])}
              />
            </div>
            <button
              type="button"
              onClick={onOpenRevenue}
              title="Open the revenue panel"
              className="mt-1 flex items-end gap-3 rounded-2xl text-left transition-opacity hover:opacity-80 cursor-pointer"
            >
              <span className="text-[46px] font-extrabold leading-[1] tracking-[-0.035em] text-ink">
                {planted ? planted.value : `$${mrr.toLocaleString()}`}
              </span>
              {!planted && (
                <span className="flex items-center gap-3 pb-1.5">
                  {momGrowth !== null && (
                    <span
                      className={cx(
                        'flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-bold tabular-nums',
                        rising ? 'bg-garden-wash text-garden-soft' : 'bg-danger-wash text-danger-ink'
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
          </div>

          {/* Everything standing behind the number, at the band's quiet end. */}
          <div className="ml-auto flex items-center gap-x-5 gap-y-2 text-right">
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-x-1.5 text-[12.5px] font-medium text-ink-faint">
                <span className="font-semibold text-ink-soft tabular-nums">
                  {activeCount.toLocaleString()} active
                </span>
                {atRiskCount > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="font-semibold text-warn-ink tabular-nums">{atRiskCount} at risk</span>
                  </>
                )}
                {!planted && previousLabel && (
                  <>
                    <span aria-hidden>·</span>
                    <span>vs. {previousLabel}</span>
                  </>
                )}
              </div>
              {planted && (
                <p className="max-w-[38ch] text-[12px] leading-snug text-ink-soft">
                  {planted.emptyNote ?? planted.caption}
                </p>
              )}
              {(historyLabel || filterSummary || planted) && (
                <div className="flex flex-wrap items-center justify-end gap-1.5">
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
            {trailing}
          </div>
        </div>
      </Surface>
    );
  }

  return (
    /*
      The reading sits on a field of its own.
      It used to float bare on the page, which works while the ground behind it is
      empty and stops working the moment a bed slides under it: white-on-green ink
      over turf, at the one place on the screen that has to stay readable. A panel
      is the same fix the stakes and the toolbar already use — the plot is busy, so
      anything that must be legible carries its own ground.
    */
    <Surface className="pointer-events-auto w-[300px] select-none p-4">
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
        className="mt-1 flex items-end gap-3 rounded-2xl text-left transition-opacity hover:opacity-80 cursor-pointer"
      >
        <span className="text-[54px] font-extrabold leading-[1] tracking-[-0.035em] text-ink">
          {planted ? planted.value : `$${mrr.toLocaleString()}`}
        </span>

        {/* The delta is a pill and the sparkline stands beside it, so the three
            together read as one figure rather than a number with notes. */}
        {!planted && (
          <span className="flex items-center gap-3 pb-2">
            {momGrowth !== null && (
              <span
                className={cx(
                  'flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-bold tabular-nums',
                  rising ? 'bg-garden-wash text-garden-soft' : 'bg-danger-wash text-danger-ink'
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

      {/* What the delta is measured against. */}
      {!planted && previousLabel && (
        <p className="mt-1 text-[12.5px] text-ink-faint">vs. {previousLabel}</p>
      )}

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
    </Surface>
  );
};
