import { Activity, Footprints, Receipt, Repeat, TicketPercent, ShieldAlert, Network, MailWarning, Cpu, ToggleRight, LayoutTemplate, WifiOff, Bot, FolderTree, Newspaper, Signpost, FileText, FlaskConical, Route, Building2, Contact, Tags, House, Inbox, LifeBuoy, ScrollText, Settings, UsersRound, type LucideProps } from "lucide-react";
import type { NavIcon as NavIconName } from "@/lib/permissions";

const icons = { home: House, staff: UsersRound, audit: ScrollText, health: Activity, settings: Settings, leads: Inbox, support: LifeBuoy, workspaces: Building2, users: Contact, plans: Tags, aiProviders: Bot, aiRoutes: Route, aiPrompts: FileText, aiEvals: FlaskConical, contentEntries: Newspaper, contentCategories: FolderTree, contentRedirects: Signpost, industryTemplates: LayoutTemplate, outage: WifiOff, quarantine: ShieldAlert, kafka: Network, deadLetters: MailWarning, workers: Cpu, featureFlags: ToggleRight, aiTraces: Footprints, subscriptions: Repeat, payments: Receipt, coupons: TicketPercent } as const;

export function NavIcon({ name, ...props }: { name: NavIconName } & LucideProps) {
  const Icon = icons[name];
  return <Icon aria-hidden {...props} />;
}
