import React from 'react';
import { CornerDownLeft, Search, Sprout } from 'lucide-react';
import { Plant } from '../types';
import { getHealthState } from '../lib/gardenUtils';
import { money } from '../lib/format';
import { comboLabel } from '../lib/useHotkeys';
import { cx } from './hud/ui';

/**
 * One box that reaches everything.
 *
 * Two hundred trees in four beds is a lovely way to see the shape of a book of
 * business and a terrible way to find Hyperion. Finding one customer meant
 * opening a popover, typing into a filter, and then hunting the highlighted
 * ring by eye. Here you type three letters and press return, and the camera
 * flies to the plant and marks it.
 *
 * Customers and commands share the list deliberately: the question "where is
 * Hyperion" and the question "how do I turn on dark mode" arrive at the same
 * moment and should not need different doors.
 */

export interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  combo?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
  plants: Plant[];
  onSelectPlant: (plant: Plant) => void;
}

type Row =
  | { kind: 'command'; key: string; command: Command }
  | { kind: 'plant'; key: string; plant: Plant };

const MAX_PLANTS = 6;
const MAX_COMMANDS = 7;

/** Prefix matches beat interior ones; everything else keeps its given order. */
function score(haystack: string, needle: string): number {
  const value = haystack.toLowerCase();
  if (!needle) return 0.5;
  if (value.startsWith(needle)) return 2;
  if (value.includes(needle)) return 1;
  return 0;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  commands,
  plants,
  onSelectPlant,
}) => {
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const rows = React.useMemo<Row[]>(() => {
    const needle = query.trim().toLowerCase();

    const matchedCommands: Row[] = commands
      .map((command) => ({
        command,
        score: Math.max(score(command.label, needle), score(command.group, needle) * 0.6),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, needle ? MAX_COMMANDS : commands.length)
      .map((entry) => ({ kind: 'command' as const, key: `c:${entry.command.id}`, command: entry.command }));

    // Customers only show up once there is something to match them against —
    // an unfiltered list of two hundred names is not a starting point.
    const matchedPlants: Row[] = needle
      ? plants
          .map((plant) => ({
            plant,
            score: Math.max(
              score(plant.customer_name, needle),
              score(plant.subscription_id, needle) * 0.9,
              score(plant.countryName ?? '', needle) * 0.5,
              score(plant.plan, needle) * 0.4
            ),
          }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score || b.plant.mrr - a.plant.mrr)
          .slice(0, MAX_PLANTS)
          .map((entry) => ({ kind: 'plant' as const, key: `p:${entry.plant.subscription_id}`, plant: entry.plant }))
      : [];

    return [...matchedPlants, ...matchedCommands];
  }, [commands, plants, query]);

  React.useEffect(() => {
    setActive((current) => Math.min(current, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  // Keep the highlighted row in view when arrowing past the fold.
  React.useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const run = (row: Row) => {
    onClose();
    if (row.kind === 'command') row.command.run();
    else onSelectPlant(row.plant);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => (rows.length ? (current + 1) % rows.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => (rows.length ? (current - 1 + rows.length) % rows.length : 0));
    } else if (event.key === 'Enter' && rows[active]) {
      event.preventDefault();
      run(rows[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-scrim p-4 pt-[12vh] backdrop-blur-[2px]"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-hairline bg-surface-solid shadow-modal"
      >
        <div className="flex items-center gap-2.5 border-b border-hairline px-4">
          <Search className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Find a customer, or run a command"
            aria-label="Find a customer, or run a command"
            className="w-full bg-transparent py-3.5 text-[14px] text-ink outline-none placeholder:text-ink-faint"
          />
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5" role="listbox">
          {rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12px] text-ink-faint">
              Nothing matches “{query}”.
            </p>
          ) : (
            rows.map((row, index) => {
              const group = row.kind === 'plant' ? 'Customers' : row.command.group;
              const heading = group !== lastGroup ? group : null;
              lastGroup = group;
              const isActive = index === active;

              return (
                <React.Fragment key={row.key}>
                  {heading && (
                    <div className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.09em] text-ink-faint">
                      {heading}
                    </div>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    data-active={isActive}
                    onMouseMove={() => setActive(index)}
                    onClick={() => run(row)}
                    className={cx(
                      'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors cursor-pointer',
                      isActive ? 'bg-accent-wash' : 'hover:bg-inset'
                    )}
                  >
                    {row.kind === 'plant' ? (
                      <>
                        <Sprout className="h-4 w-4 shrink-0 text-accent-soft" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-ink">
                            {row.plant.countryFlag ? `${row.plant.countryFlag} ` : ''}
                            {row.plant.customer_name}
                          </span>
                          <span className="block truncate text-[11px] text-ink-faint">
                            {row.plant.plan} · {money(row.plant.mrr)}/mo · {getHealthState(row.plant)}
                          </span>
                        </span>
                      </>
                    ) : (
                      <>
                        <row.command.icon className="h-4 w-4 shrink-0 text-ink-faint" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-ink">
                            {row.command.label}
                          </span>
                          {row.command.hint && (
                            <span className="block truncate text-[11px] text-ink-faint">{row.command.hint}</span>
                          )}
                        </span>
                        {row.command.combo && (
                          <kbd className="shrink-0 rounded-md border border-hairline bg-inset px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint">
                            {comboLabel(row.command.combo)}
                          </kbd>
                        )}
                      </>
                    )}
                    {isActive && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-accent-soft" />}
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
