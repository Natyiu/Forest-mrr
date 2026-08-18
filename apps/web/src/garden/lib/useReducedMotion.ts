import React from 'react';

/**
 * Whether the machine has asked us to stop moving.
 *
 * The plot runs a 60fps canvas with drifting snow, falling leaves, rain and a
 * per-frame sway on every tree. For a reader with vestibular sensitivity that
 * is not atmosphere, it is a reason to close the tab — and `prefers-reduced-
 * motion` is how they have already told the browser so.
 *
 * The garden still draws, and still updates: what stops is the *idle* motion,
 * the movement that carries no information. Nothing that encodes data is ever
 * hidden by this.
 */

const QUERY = '(prefers-reduced-motion: reduce)';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches
  );

  React.useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia(QUERY);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * Whether this tab is on screen.
 *
 * A backgrounded garden used to keep a full animation loop running — a laptop
 * on battery paying to render snow nobody is looking at.
 */
export function usePageVisible(): boolean {
  const [visible, setVisible] = React.useState(
    () => typeof document === 'undefined' || !document.hidden
  );

  React.useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  return visible;
}
