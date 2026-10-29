import type { LucideIcon } from "lucide-react";
import { LayoutGrid, User, Package, Heart, MapPin, RotateCcw, ShieldCheck } from "lucide-react";

export const ACCOUNT_NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/account", label: "Overview", icon: LayoutGrid },
  { to: "/account/profile", label: "Profile", icon: User },
  { to: "/account/orders", label: "Orders", icon: Package },
  { to: "/account/wishlist", label: "Wishlist", icon: Heart },
  { to: "/account/addresses", label: "Addresses", icon: MapPin },
  { to: "/account/returns", label: "Returns", icon: RotateCcw },
  { to: "/account/security", label: "Security", icon: ShieldCheck },
];
