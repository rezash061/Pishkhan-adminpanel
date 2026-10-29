import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const tones = {
  info: "border-primary/30 bg-primary/5 text-foreground",
  warning: "border-warning/50 bg-warning/10 text-foreground",
  danger: "border-danger/40 bg-danger/10 text-danger",
  success: "border-success/40 bg-success/10 text-foreground",
} as const;

export function Alert({ className, tone = "info", ...props }: HTMLAttributes<HTMLDivElement> & { tone?: keyof typeof tones }) {
  return <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-md border px-4 py-3 text-sm", tones[tone], className)} {...props} />;
}
