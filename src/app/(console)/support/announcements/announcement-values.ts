import type { AdminAnnouncement, AnnouncementRequest } from "@/lib/api/types";

export interface AnnouncementFormValues {
  title: string;
  body: string;
  severity: string;
  link: string;
  /** `datetime-local` values in the browser's time zone, or empty. */
  startsAt: string;
  endsAt: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO instant to a `datetime-local` value in the browser's time zone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A `datetime-local` value to an ISO instant, or null when empty or invalid. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function toFormValues(a: AdminAnnouncement | null): AnnouncementFormValues {
  return a
    ? { title: a.title, body: a.body ?? "", severity: a.severity, link: a.link ?? "", startsAt: toLocalInput(a.startsAt), endsAt: toLocalInput(a.endsAt) }
    : { title: "", body: "", severity: "info", link: "", startsAt: "", endsAt: "" };
}

export function toRequest(v: AnnouncementFormValues): AnnouncementRequest {
  return {
    title: v.title.trim(),
    body: v.body.trim() || null,
    severity: v.severity,
    link: v.link.trim() || null,
    startsAt: fromLocalInput(v.startsAt),
    endsAt: fromLocalInput(v.endsAt),
  };
}
