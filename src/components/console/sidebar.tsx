"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import type { NavItem } from "@/lib/permissions";
import { NavIcon } from "./nav-icon";

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ items, open, onNavigate }: { items: NavItem[]; open: boolean; onNavigate: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const sections = ["main", "support", "billing", "ai", "security", "platform", "account"] as const;

  return (
    <nav
      id="console-nav"
      aria-label={t("menu")}
      className={cn(
        "fixed inset-y-0 start-0 z-30 w-60 shrink-0 overflow-y-auto bg-sidebar px-3 py-4 text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
        // The app is always RTL: the drawer sits on the right and slides out to the right.
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      {sections.map((section) => {
        const sectionItems = items.filter((i) => i.section === section);
        if (sectionItems.length === 0) return null;
        return (
          <div key={section} className="mb-5">
            <p className="mb-1 px-2 text-xs font-medium text-sidebar-muted">{t(`sections.${section}`)}</p>
            <ul className="flex flex-col gap-0.5">
              {sectionItems.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-sidebar-active",
                        active && "bg-sidebar-active font-semibold",
                      )}
                    >
                      <NavIcon name={item.icon} className="size-4" />
                      {t(item.labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
