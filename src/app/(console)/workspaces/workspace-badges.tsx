"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { AdminWorkspaceChannel } from "@/lib/api/types";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const STATUS_TONES: Record<string, Tone> = { active: "success", suspended: "danger", pending_deletion: "warning", deleted: "neutral" };
const CHANNEL_TONES: Record<string, Tone> = {
  active: "success",
  connecting: "info",
  token_expiring: "warning",
  reauth_required: "danger",
  disconnected: "neutral",
};

export function WorkspaceStatusBadge({ status }: { status: string }) {
  const t = useTranslations("workspaces.statuses");
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{t.has(status) ? t(status) : status}</Badge>;
}

export function ChannelStatusBadge({ status }: { status: string }) {
  const t = useTranslations("workspaces.channelStatuses");
  return <Badge tone={CHANNEL_TONES[status] ?? "neutral"}>{t.has(status) ? t(status) : status}</Badge>;
}

/** `@username` for Instagram, otherwise the channel kind. */
export function channelLabel(channel: AdminWorkspaceChannel): string {
  return channel.username ? `@${channel.username.replace(/^@/, "")}` : channel.kind;
}
