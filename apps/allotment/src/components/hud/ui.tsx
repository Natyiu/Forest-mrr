import React from 'react';

/**
 * HUD primitives.
 *
 * Every panel in this app used to carry its own copy of the same twelve Tailwind
 * classes, so a change to the chrome meant editing nine files and missing one.
 * Surfaces, buttons and chips are defined once here; the HUD components below
 * only describe *what* they contain.
 *
 * Colours are semantic tokens (`surface`, `ink`, `accent`) resolved at runtime
 * by `ThemeProvider`. Nothing here names a hue, which is why light, dark and
 * four seasons cost this file zero conditionals.
 */

export const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

/** The one card treatment used by every floating panel. */
export const Surface: React.FC<{
  className?: string;
  children: React.ReactNode;
  as?: 'div' | 'section';
}> = ({ className, children }) => (
  <div
    className={cx(
      'rounded-2xl border border-hairline bg-surface backdrop-blur-md shadow-panel',
      className
    )}
  >
    {children}
  </div>
);

type Tone = 'plain' | 'primary' | 'active';

const TONES: Record<Tone, string> = {
  plain: 'text-ink-soft hover:text-ink hover:bg-inset',
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover shadow-sm',
  active: 'bg-accent-wash text-accent-soft ring-1 ring-accent-line',
};

/** Icon-only control with an accessible name and a hover label. */
export const IconButton: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  tone?: Tone;
  badge?: number;
}> = ({ icon: Icon, label, onClick, tone = 'plain', badge }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className={cx(
      'group relative grid h-9 w-9 place-items-center rounded-xl transition-colors cursor-pointer',
      TONES[tone]
    )}
  >
    <Icon className="h-[18px] w-[18px]" />
    {badge ? (
      <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink">
        {badge}
      </span>
    ) : null}
  </button>
);

/** Text button, used for the few actions that need a name in the open. */
export const TextButton: React.FC<{
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onClick: () => void;
  tone?: Tone;
}> = ({ icon: Icon, children, onClick, tone = 'plain' }) => (
  <button
    type="button"
    onClick={onClick}
    className={cx(
      'flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold transition-colors cursor-pointer',
      TONES[tone]
    )}
  >
    {Icon ? <Icon className="h-[15px] w-[15px]" /> : null}
    {children}
  </button>
);

/** Filter pill: a colour dot, a label, and a count. */
export const Chip: React.FC<{
  label: string;
  count?: number;
  dot?: string;
  selected?: boolean;
  onClick: () => void;
}> = ({ label, count, dot, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={cx(
      'flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all cursor-pointer',
      selected
        ? 'bg-accent text-accent-ink'
        : 'bg-inset text-ink-soft hover:bg-inset-strong hover:text-ink'
    )}
  >
    {dot ? (
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
    ) : null}
    {label}
    {count !== undefined ? (
      <span className={cx('tabular-nums', selected ? 'text-accent-ink/70' : 'text-ink-faint')}>{count}</span>
    ) : null}
  </button>
);

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-ink-faint">{children}</div>
);

export const Divider: React.FC = () => <span className="mx-1 h-5 w-px bg-hairline" />;

/**
 * Escape closes. Every overlay in the app uses this, so dismissal is one
 * behaviour rather than five different ones — the cohort modal used to trap you
 * until you found its ✕.
 */
export function useEscapeToClose(open: boolean, onClose: () => void) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}

/** Backdrop props: clicking outside the panel closes it. */
export const backdropProps = (onClose: () => void) => ({
  onClick: (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) onClose();
  },
});

/** Anchored popover. Click-away and Escape close it. */
export const Popover: React.FC<{
  open: boolean;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}> = ({ open, onClose, className, children }) => {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <Surface className={cx('absolute z-50 w-[300px] p-4', className)}>{children}</Surface>
    </>
  );
};
