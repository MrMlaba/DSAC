import type { Role } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import { LayoutDashboardIcon, Building2Icon, FileTextIcon, KanbanIcon, AlertTriangleIcon, ShieldIcon } from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Omit to allow every role. */
  roles?: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Entities", href: "/entities", icon: Building2Icon },
  { title: "Documents", href: "/documents", icon: FileTextIcon },
  { title: "Tasks", href: "/tasks", icon: KanbanIcon },
  { title: "Early Warning", href: "/risk", icon: AlertTriangleIcon },
  { title: "Audit Log", href: "/audit-log", icon: ShieldIcon, roles: ["DSAC_ADMIN"] },
];

export function navItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}
