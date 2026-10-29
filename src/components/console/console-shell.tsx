"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, LogOut, Menu, Search, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/logout";
import { navFor } from "@/lib/permissions";
import { CommandPalette } from "./command-palette";
import { IdleTimeout } from "./idle-timeout";
import { Sidebar } from "./sidebar";
import { StaffProvider } from "./staff-context";
import { StepUpProvider } from "./step-up";

interface Props {
  staff: { id: string; username: string; roles: string[] };
  mock: boolean;
  children: ReactNode;
}

export function ConsoleShell({ staff, mock, children }: Props) {
  const t = useTranslations();
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const items = navFor(staff.roles);

  return (
    <StaffProvider staff={staff}>
      <StepUpProvider>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
          {t("app.skipToContent")}
        </a>
        <div className="flex min-h-dvh">
          <Sidebar items={items} open={navOpen} onNavigate={() => setNavOpen(false)} />
          {navOpen ? <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden /> : null}
          <div className="flex min-w-0 flex-1 flex-col">
            {mock ? (
              <Alert tone="warning" className="rounded-none border-x-0 border-t-0 text-center">
                {t("app.mockBanner")}
              </Alert>
            ) : null}
            <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label={t("nav.toggle")}
                aria-expanded={navOpen}
                aria-controls="console-nav"
                onClick={() => setNavOpen((o) => !o)}
              >
                <Menu className="size-5" aria-hidden />
              </Button>
              <span className="font-bold">
                {t("app.console")} {t("app.name")}
              </span>
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="ms-auto flex h-9 w-full max-w-xs items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground hover:bg-muted"
              >
                <Search className="size-4" aria-hidden />
                <span className="flex-1 text-start">{t("topbar.commandPalette")}</span>
                <kbd className="ltr hidden rounded border border-border px-1.5 text-xs sm:inline">{t("topbar.shortcut")}</kbd>
              </button>
              <DropdownMenu.Root dir="rtl">
                <DropdownMenu.Trigger asChild>
                  <Button variant="ghost" size="sm" aria-label={t("topbar.signedInAs", { username: staff.username })}>
                    <UserRound className="size-4" aria-hidden />
                    <span className="ltr hidden sm:inline">{staff.username}</span>
                    <ChevronDown className="size-3" aria-hidden />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-48 rounded-md border border-border bg-surface p-1 shadow-md">
                    <DropdownMenu.Label className="px-2 py-1.5 text-xs text-muted-foreground">
                      {staff.roles.map((r) => (t.has(`roles.${r}`) ? t(`roles.${r}`) : r)).join("، ")}
                    </DropdownMenu.Label>
                    <DropdownMenu.Separator className="my-1 h-px bg-border" />
                    <DropdownMenu.Item
                      onSelect={() => void logout("loggedOut")}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted"
                    >
                      <LogOut className="size-4" aria-hidden />
                      {t("topbar.logout")}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </header>
            <main id="main" className="flex-1 px-4 py-6 lg:px-8">
              {children}
            </main>
          </div>
        </div>
        <CommandPalette items={items} open={paletteOpen} onOpenChange={setPaletteOpen} />
        <IdleTimeout />
      </StepUpProvider>
    </StaffProvider>
  );
}
