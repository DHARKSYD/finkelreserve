import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { House, MessageCircle, ShoppingCart, Store, User, type LucideIcon } from "lucide-react";
import { useCart } from "@/lib/store";
import { useAuth } from "@/hooks/use-auth";

type Tab = {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
  isActive: (path: string) => boolean;
};

// Phone/tablet bottom navigation (below the `lg` breakpoint, where the desktop header takes
// over). Five fixed destinations, thumb-reachable, in the order the business asked for:
// HOME · SHOP · YOU · CART · CONTACT. "Our Story" and "Wine Guide" are not tabs — they are
// surfaced on every page by <DiscoverStrip /> and in the footer.
//
// Active tab = filled icon + brand colour, inactive = outline + muted, the same convention
// shopping apps use so it reads instantly.
export function MobileTabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useAuth();
  const cart = useCart();
  // The bag is persisted in localStorage, so the server renders it empty while the first
  // client render may not be — only show the badge after mount (avoids a hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // A product page has its own sticky "Add to bag" bar at the bottom; two stacked bars would
  // eat a third of a small screen, so (like most shopping apps) the product page owns the bottom.
  if (path.startsWith("/product/")) return null;

  const tabs: Tab[] = [
    { key: "home", label: "Home", to: "/", icon: House, isActive: (p) => p === "/" },
    {
      key: "shop",
      label: "Shop",
      to: "/shop",
      icon: Store,
      isActive: (p) => p === "/shop" || p.startsWith("/shop/"),
    },
    {
      key: "you",
      label: "You",
      // While the session is still loading, aim at /account: it shows "Loading…" and sends a
      // signed-out visitor on to /auth, whereas /auth would bounce a signed-in one to the homepage.
      to: user || loading ? "/account" : "/auth",
      icon: User,
      isActive: (p) =>
        p.startsWith("/account") || p === "/auth" || p === "/reset-password" || p === "/wishlist",
    },
    {
      key: "cart",
      label: "Cart",
      to: "/cart",
      icon: ShoppingCart,
      isActive: (p) => p === "/cart" || p.startsWith("/order-confirmation"),
    },
    {
      key: "contact",
      label: "Contact",
      to: "/contact",
      icon: MessageCircle,
      isActive: (p) => p === "/contact",
    },
  ];
  const cartCount = mounted ? cart.totalCount() : 0;

  return (
    <>
      {/* Takes the bar's place in the page flow so the footer's last line is never hidden behind it. */}
      <div aria-hidden="true" className="h-[calc(3.75rem+env(safe-area-inset-bottom))] lg:hidden" />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {tabs.map((tab) => {
            const active = tab.isActive(path);
            const Icon = tab.icon;
            return (
              <li key={tab.key} className="min-w-0">
                <Link
                  to={tab.to}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-[3.75rem] flex-col items-center justify-center gap-1 transition-colors ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-primary"
                    />
                  )}
                  <span className="relative">
                    <Icon
                      className="h-[22px] w-[22px]"
                      strokeWidth={active ? 2 : 1.7}
                      fill={active ? "currentColor" : "none"}
                      fillOpacity={active ? 0.9 : 0}
                      aria-hidden="true"
                    />
                    {tab.key === "cart" && cartCount > 0 && (
                      <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-foreground ring-2 ring-background">
                        {cartCount > 99 ? "99+" : cartCount}
                      </span>
                    )}
                  </span>
                  <span
                    className={`max-w-full truncate px-0.5 text-[10px] uppercase leading-none tracking-wider ${
                      active ? "font-bold" : "font-medium"
                    }`}
                  >
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
