import type { Role } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboardIcon,
  Building2Icon,
  FileTextIcon,
  LifeBuoyIcon,
  BellRingIcon,
  SettingsIcon,
  TargetIcon,
  WalletIcon,
  ClipboardCheckIcon,
  FolderIcon,
  IdCardIcon,
} from "lucide-react";
import { isDsacWideRole } from "@/lib/constants";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Omit to allow every role that sees this sidebar. */
  roles?: Role[];
}

/** DSAC sidebar — deliberately short. Everything else is one click deeper, inside an entity. */
const DSAC_NAV: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Entities & NPOs", href: "/entities", icon: Building2Icon },
  { title: "Reports", href: "/reports", icon: FileTextIcon },
  { title: "Requests / Support", href: "/requests", icon: LifeBuoyIcon },
  { title: "Alerts", href: "/alerts", icon: BellRingIcon },
  { title: "Administration", href: "/administration", icon: SettingsIcon, roles: ["DSAC_ADMIN"] },
];

/** Entity / NPO portal sidebar. */
const ENTITY_NAV: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Performance", href: "/performance", icon: TargetIcon },
  { title: "Finance", href: "/finance", icon: WalletIcon },
  { title: "Compliance", href: "/compliance", icon: ClipboardCheckIcon },
  { title: "Reports", href: "/reports", icon: FileTextIcon },
  { title: "Requests", href: "/requests", icon: LifeBuoyIcon },
  { title: "Documents", href: "/documents", icon: FolderIcon },
  { title: "Profile", href: "/profile", icon: IdCardIcon },
];

export function navItemsForRole(role: Role): NavItem[] {
  const items = isDsacWideRole(role) ? DSAC_NAV : ENTITY_NAV;
  return items.filter((item) => !item.roles || item.roles.includes(role));
}
