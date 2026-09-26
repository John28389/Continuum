"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Menu, X } from "lucide-react";

import { NAV_ITEMS, isActive } from "./nav-items";
import { ptBR } from "@/lib/i18n/pt-BR";
import { cn } from "@/lib/utils";

/**
 * Navigation for the seven areas.
 *
 * A persistent rail on desktop, a drawer on small screens. Seven entries is too
 * many for a bottom tab bar, and cramming them in would make each one a smaller
 * target than the last — worse than a drawer that opens in one tap.
 *
 * Active state is a neutral emphasis rather than one of the content-class
 * colours. Those are reserved for content, so that mission-level weight still
 * means something when it appears.
 */

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <ul className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
        const active = isActive(pathname, href);

        return (
          <li key={key}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[--radius-base] px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              {ptBR.nav[key]}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Wordmark() {
  return <span className="font-mono text-xs tracking-widest uppercase">{ptBR.app.name}</span>;
}

export function AppNav() {
  const [open, setOpen] = useState(false);

  // The drawer is closed by the link's own onNavigate rather than by an effect
  // watching the pathname. Setting state from an effect to react to a render
  // causes a second render pass for something the click already knew.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      {/* Desktop rail */}
      <nav
        aria-label={ptBR.shell.primaryNavigation}
        className="hidden w-60 shrink-0 flex-col gap-6 border-r border-border bg-surface px-3 py-5 md:flex"
      >
        <div className="px-3 text-muted-foreground">
          <Wordmark />
        </div>
        <NavLinks />
      </nav>

      {/* Small-screen header */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={ptBR.shell.openMenu}
          aria-expanded={open}
          className="-ml-2 rounded-[--radius-base] p-2 transition-colors hover:bg-muted"
        >
          <Menu aria-hidden className="size-5" />
        </button>
        <div className="text-muted-foreground">
          <Wordmark />
        </div>
      </header>

      {/* Small-screen drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          {/*
            Click-outside for pointer users. Hidden from assistive technology so
            that "Fechar menu" resolves to exactly one control; keyboard users
            close with Escape or the button below.
          */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <nav
            aria-label={ptBR.shell.primaryNavigation}
            className="relative flex h-full w-72 max-w-[85%] flex-col gap-6 border-r border-border bg-surface px-3 py-5"
          >
            <div className="flex items-center justify-between px-3">
              <span className="text-muted-foreground">
                <Wordmark />
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={ptBR.shell.closeMenu}
                className="-mr-2 rounded-[--radius-base] p-2 transition-colors hover:bg-muted"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
          </nav>
        </div>
      ) : null}
    </>
  );
}
