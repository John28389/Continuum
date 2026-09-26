import {
  BookOpen,
  History,
  Lightbulb,
  type LucideIcon,
  Scale,
  Settings,
  Target,
  LayoutDashboard,
} from "lucide-react";

import { ptBR } from "@/lib/i18n/pt-BR";

/**
 * The seven areas, defined once.
 *
 * Seven is a closed set, not a starting point. The product's whole argument is
 * that a screen showing everything shows nothing, so an eighth entry needs a
 * decision entry justifying it — and almost certainly belongs inside one of
 * these instead.
 */
export interface NavItem {
  readonly key: keyof typeof ptBR.nav;
  readonly href: string;
  readonly icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "missions", href: "/missions", icon: Target },
  { key: "curiosities", href: "/curiosities", icon: Lightbulb },
  { key: "knowledge", href: "/knowledge", icon: BookOpen },
  { key: "history", href: "/history", icon: History },
  { key: "rules", href: "/rules", icon: Scale },
  { key: "settings", href: "/settings", icon: Settings },
];

/** Marks the active area, treating nested routes as part of their section. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
