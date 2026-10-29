"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type { NavItem } from "@/lib/permissions";
import { NavIcon } from "./nav-icon";

/** Ctrl+K / ⌘K: jump to any page the staff member can see. */
export function CommandPalette({ items, open, onOpenChange }: { items: NavItem[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("palette");
  const tn = useTranslations("nav");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => !q || tn(i.labelKey).toLowerCase().includes(q) || i.href.includes(q));
  }, [items, query, tn]);

  const go = (href: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
        setIndex(0);
      }}
    >
      <DialogContent title={t("title")} className="top-24 translate-y-0">
        <Input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls="palette-results"
          aria-activedescendant={results[index] ? `palette-${index}` : undefined}
          placeholder={t("placeholder")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && results[index]) {
              e.preventDefault();
              go(results[index].href);
            }
          }}
        />
        <ul id="palette-results" role="listbox" className="mt-3 max-h-72 overflow-y-auto">
          {results.length === 0 ? <li className="px-2 py-3 text-sm text-muted-foreground">{t("empty")}</li> : null}
          {results.map((item, i) => (
            <li
              key={item.href}
              id={`palette-${i}`}
              role="option"
              aria-selected={i === index}
              onMouseEnter={() => setIndex(i)}
              onClick={() => go(item.href)}
              className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm", i === index && "bg-muted")}
            >
              <NavIcon name={item.icon} className="size-4 text-muted-foreground" />
              {tn(item.labelKey)}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
