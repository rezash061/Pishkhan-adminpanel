import { Activity, Bot, FolderTree, Newspaper, Signpost, FileText, FlaskConical, Route, Building2, Contact, Tags, House, Inbox, LifeBuoy, ScrollText, Settings, UsersRound, type LucideProps } from "lucide-react";
import type { NavIcon as NavIconName } from "@/lib/permissions";

const icons = { home: House, staff: UsersRound, audit: ScrollText, health: Activity, settings: Settings, leads: Inbox, support: LifeBuoy, workspaces: Building2, users: Contact, plans: Tags, aiProviders: Bot, aiRoutes: Route, aiPrompts: FileText, aiEvals: FlaskConical, contentEntries: Newspaper, contentCategories: FolderTree, contentRedirects: Signpost } as const;

export function NavIcon({ name, ...props }: { name: NavIconName } & LucideProps) {
  const Icon = icons[name];
  return <Icon aria-hidden {...props} />;
}
