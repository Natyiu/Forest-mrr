import React from 'react';

/**
 * Keyboard access to everything the toolbar can do.
 *
 * The dashboard was entirely mouse-driven: to find one customer among two
 * hundred trees you opened a popover, clicked a field and typed. Every action
 * now has a key, every key is declared in one list, and that list is the same
 * data the guide and the command palette render — so a shortcut cannot exist
 * without being documented, and the documentation cannot go stale.
 *
 * Bindings are matched against `event.key`, so they follow the user's layout
 * rather than physical key positions.
 */

export interface Hotkey {
  /** 'k' · 'mod+k' · 'shift+?' · 'ArrowLeft'. `mod` is ⌘ on Mac, Ctrl elsewhere. */
  combo: string;
  /** Shown in the guide and the palette. */
  label: string;
  group: string;
  run: () => void;
  /** Fires even while a text field has focus. Escape-like keys only. */
  allowInInput?: boolean;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** '⌘K' on a Mac, 'Ctrl K' everywhere else. */
export function comboLabel(combo: string): string {
  return combo
    .split('+')
    .map((part) => {
      if (part === 'mod') return isMac ? '⌘' : 'Ctrl';
      if (part === 'shift') return isMac ? '⇧' : 'Shift';
      if (part === 'alt') return isMac ? '⌥' : 'Alt';
      if (part === 'ArrowLeft') return '←';
      if (part === 'ArrowRight') return '→';
      if (part === ' ') return 'Space';
      return part.length === 1 ? part.toUpperCase() : part;
    })
    .join(isMac ? '' : ' ');
}

function matches(event: KeyboardEvent, combo: string): boolean {
  const parts = combo.split('+');
  const key = parts[parts.length - 1];
  const wantMod = parts.includes('mod');
  const wantShift = parts.includes('shift');
  const wantAlt = parts.includes('alt');

  const hasMod = isMac ? event.metaKey : event.ctrlKey;
  if (wantMod !== hasMod) return false;
  if (wantAlt !== event.altKey) return false;
  // Shift is implied by any key that needs it to be typed at all ('?'), so it
  // is only compared when the binding asks for it.
  if (wantShift && !event.shiftKey) return false;

  return key.length === 1
    ? event.key.toLowerCase() === key.toLowerCase()
    : event.key === key;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable;
}

export function useHotkeys(hotkeys: Hotkey[], enabled = true) {
  // Held in a ref so a re-render with fresh closures does not detach the
  // listener — otherwise every keystroke that changes state drops the next one.
  const ref = React.useRef(hotkeys);
  ref.current = hotkeys;

  React.useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const typing = isTypingTarget(event.target);

      for (const hotkey of ref.current) {
        if (typing && !hotkey.allowInInput) continue;
        if (!matches(event, hotkey.combo)) continue;
        event.preventDefault();
        hotkey.run();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
