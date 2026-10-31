import { Activity, House, Inbox, LifeBuoy, ScrollText, Settings, UsersRound, type LucideProps } from "lucide-react";
import type { NavIcon as NavIconName } from "@/lib/permissions";

const icons = { home: House, staff: UsersRound, audit: ScrollText, health: Activity, settings: Settings, leads: Inbox, support: LifeBuoy } as const;

export function NavIcon({ name, ...props }: { name: NavIconName } & LucideProps) {
  const Icon = icons[name];
  return <Icon aria-hidden {...props} />;
}
