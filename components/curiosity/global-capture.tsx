"use client";

import { useEffect, useState } from "react";

import { Lightbulb, X } from "lucide-react";

import { QuickCapture } from "./quick-capture";
import { useHydrated } from "@/components/mission/clock";
import { ptBR } from "@/lib/i18n/pt-BR";

const copy = ptBR.curiosity;

/** True while typing somewhere a single letter keystroke means text, not a shortcut. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * Capture, reachable from anywhere.
 *
 * A curiosity has to be captured at the moment it appears, wherever that
 * happens to be — mid-session on a mission, reading a rule, anywhere. This
 * mounts once in the app shell: a small floating control, plus the "C"
 * keyboard shortcut, both opening the same one-field form. Closes itself on
 * Escape or the moment capture succeeds, so it never lingers as a second
 * thing to deal with.
 *
 * The shortcut exists only once the page has hydrated and the listener below
 * is attached; a key pressed before that is simply lost. `data-capture-ready`
 * marks the moment, so an end-to-end test can wait for it instead of racing it.
 */
export function GlobalCapture() {
  const [open, setOpen] = useState(false);
  const hydrated = useHydrated();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape" && open) {
        setOpen(false);
        return;
      }

      if (!open && (event.key === "c" || event.key === "C") && !isTyping(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div
      data-capture-ready={hydrated ? "" : undefined}
      className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6"
    >
      {open ? (
        <div
          role="dialog"
          aria-label={copy.captureLabel}
          className="w-[min(20rem,calc(100vw-2rem))] rounded-[--radius-base] border border-border bg-surface p-4 shadow-lg"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{copy.captureLabel}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={copy.closeCapture}
              className="-mt-1 -mr-1 rounded-[--radius-base] p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <QuickCapture autoFocus onCaptured={() => setOpen(false)} />
          <p className="mt-3 text-xs text-muted-foreground">{copy.captureShortcut}</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={copy.openCapture}
          title={copy.captureShortcut}
          className="flex items-center gap-2 rounded-full border border-curiosity/30 bg-curiosity-subtle px-4 py-2.5 text-sm font-medium text-curiosity shadow-lg transition-colors hover:bg-curiosity-subtle/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Lightbulb aria-hidden className="size-4" />
          {copy.openCapture}
        </button>
      )}
    </div>
  );
}
