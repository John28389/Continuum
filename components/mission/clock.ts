import { useSyncExternalStore } from "react";

/**
 * Time, for client components that must show it.
 *
 * Two things this solves at once. The server does not know the reader's
 * timezone — the profile default is UTC and nothing sets it — so any wall-clock
 * time has to be formatted in the browser. And a value that differs between the
 * server render and the first client render is a hydration mismatch. Returning
 * null during both makes the first client render identical to the server's,
 * after which React re-renders with the real value.
 */

const noop = () => () => {};

/** False on the server and during hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/**
 * Twice a minute, not every second.
 *
 * The display shows minutes, so a faster tick would only redraw the same text.
 * It would also turn the timer into something to watch, and a running session
 * should be something you can forget about until you stop it.
 */
const TICK_MS = 30_000;

let now = 0;
let interval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (interval === null) {
    // Refreshed on first subscription, or a page returned to after an hour
    // would show an hour-old elapsed time until the first tick.
    now = Date.now();
    interval = setInterval(() => {
      now = Date.now();
      for (const notify of listeners) notify();
    }, TICK_MS);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && interval !== null) {
      clearInterval(interval);
      interval = null;
    }
  };
}

function getSnapshot(): number {
  if (now === 0) now = Date.now();
  return now;
}

function getServerSnapshot(): null {
  return null;
}

/** The current instant, refreshed twice a minute; null until hydrated. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
