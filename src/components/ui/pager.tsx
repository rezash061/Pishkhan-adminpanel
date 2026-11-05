"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toPersianDigits } from "@/lib/format";

/** Footer of a paged table: total count and previous/next over `page`, `pageSize`, `totalCount` (overview section 6). */
export function Pager({ page, pageSize, totalCount, onPage }: { page: number; pageSize: number; totalCount: number; onPage: (page: number) => void }) {
  const tc = useTranslations("common");
  const pages = Math.max(1, Math.ceil(totalCount / pageSize));
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span className="text-muted-foreground">{tc("total", { count: totalCount })}</span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {tc("previous")}
        </Button>
        <span>{tc("pageOf", { page: toPersianDigits(page), pages: toPersianDigits(pages) })}</span>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          {tc("next")}
        </Button>
      </div>
    </div>
  );
}
