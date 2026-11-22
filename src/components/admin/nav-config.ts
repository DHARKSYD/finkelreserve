import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Boxes,
  Users,
  CreditCard,
  Tag,
  Star,
  BarChart3,
  Truck,
  RotateCcw,
  Activity,
  UserCog,
  Settings,
} from "lucide-react";

export type AdminNavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Nav items without this render fully; "soon" ones route to a shared placeholder. */
  status?: "soon";
  /** Only shown to super admins. The pages and the database functions enforce it again. */
  superAdminOnly?: boolean;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { label: "Overview", to: "/admin", icon: LayoutDashboard },
  { label: "Orders", to: "/admin/orders", icon: ShoppingBag },
  { label: "Products", to: "/admin/products", icon: Package },
  { label: "Inventory", to: "/admin/inventory", icon: Boxes },
  { label: "Customers", to: "/admin/customers", icon: Users },
  { label: "Payments", to: "/admin/payments", icon: CreditCard },
  { label: "Promotions", to: "/admin/promotions", icon: Tag },
  { label: "Reviews", to: "/admin/reviews", icon: Star },
  { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
  { label: "Shipping", to: "/admin/shipping", icon: Truck },
  { label: "Returns", to: "/admin/returns", icon: RotateCcw },
  { label: "Activity", to: "/admin/activity", icon: Activity },
  { label: "Team", to: "/admin/team", icon: UserCog, superAdminOnly: true },
  { label: "Settings", to: "/admin/settings", icon: Settings },
];
