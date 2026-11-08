import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Heart, Search, ShoppingBag, User, ChevronDown, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart, useWishlist } from "@/lib/store";
import { useAuth } from "@/hooks/use-auth";
import { SearchModal } from "./SearchModal";
import { ThemeToggle } from "./ThemeToggle";
import type { ProductType } from "@/lib/products";

const QUICK: { type: ProductType; label: string }[] = [
  { type: "red", label: "Red" },
  { type: "white", label: "White" },
  { type: "rose", label: "Rosé" },
  { type: "sparkling", label: "Sparkling" },
  { type: "whiskey", label: "Whiskey" },
  { type: "cognac", label: "Cognac" },
  { type: "gin", label: "Gin" },
];

type MenuKey = "shop" | null;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  // The cart is persisted in localStorage, so the server renders an empty bag while the
  // first client render has items — a hydration mismatch (React #418). Show the badge
  // only after mount so both renders agree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menu, setMenu] = useState<MenuKey>(null);
  const cart = useCart();
  const wish = useWishlist();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useRouterState({ select: (s) => s.location });
  const path = loc.pathname;
  // A page that opens on a dark hero marks it with `data-dark-hero` (the homepage's ScrollHero
  // does). While that hero is still behind the header the navbar stays transparent with light
  // text (see .nav-on-dark in styles.css); once it has mostly scrolled away it becomes the light
  // glass pill, which turns a muddy grey with unreadable links if it sits over dark footage.
  // `path === "/"` keeps the server-rendered first paint correct, before the scroll check runs.
  const [pastHero, setPastHero] = useState(false);
  const overDarkHero = path === "/" && !pastHero;
  const currentType = (loc.search as { type?: string })?.type ?? null;

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      // The hero's lower part is its brightest (the lit floor), so hand over to the glass pill once
      // about half of it has scrolled away rather than at the very end.
      const hero = document.querySelector("[data-dark-hero]");
      setPastHero(!hero || hero.getBoundingClientRect().bottom <= window.innerHeight * 0.5);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [path]);

  useEffect(() => {
    setMenu(null);
  }, [path, currentType]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const goShop = (params: { type?: ProductType }) => {
    navigate({ to: "/shop", search: params });
    setMenu(null);
  };

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? "py-3" : "py-5"}`}
      >
        <div
          className={`mx-auto max-w-[1400px] px-4 md:px-8 transition-all ${
            scrolled && !overDarkHero ? "glass rounded-2xl mx-3 md:mx-6 px-4 md:px-6" : ""
          } ${overDarkHero ? "nav-on-dark" : ""}`}
        >
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="relative h-9 w-9 rounded-lg bg-wine shadow-glow grid place-items-center">
                <span className="font-display font-black text-primary-foreground text-lg">F</span>
              </div>
              <span className="font-display font-black tracking-tight text-lg md:text-xl">
                FINKEL<span className="text-gradient-wine">·</span>RESERVE
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-1" onMouseLeave={() => setMenu(null)}>
              <NavItem to="/" label="Home" exact />

              {/* Shop dropdown */}
              <DropdownTrigger
                label="Shop"
                active={path === "/shop"}
                onEnter={() => setMenu("shop")}
                isOpen={menu === "shop"}
              >
                <div className="grid grid-cols-2 gap-2 p-4 w-[420px]">
                  <button
                    onClick={() => goShop({})}
                    className="text-left px-3 py-2.5 rounded-lg hover:bg-surface-2 transition"
                  >
                    <p className="text-sm font-bold">All products</p>
                    <p className="text-[11px] text-muted-foreground">Everything in store</p>
                  </button>
                  {QUICK.map((q) => (
                    <button
                      key={q.type}
                      onClick={() => goShop({ type: q.type })}
                      className={`text-left px-3 py-2.5 rounded-lg transition ${
                        currentType === q.type
                          ? "bg-primary/10 ring-1 ring-primary"
                          : "hover:bg-surface-2"
                      }`}
                    >
                      <p className="text-sm font-bold">{q.label}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{q.type}</p>
                    </button>
                  ))}
                </div>
              </DropdownTrigger>

              <NavItem to="/about" label="Our Story" />
              <NavItem to="/blog" label="Wine Guide" />
              <NavItem to="/contact" label="Contact" />
            </nav>

            {/* Below `lg` the bottom tab bar (MobileTabBar) carries Home / Shop / You / Cart /
                Contact, so the header only keeps what the bar doesn't: search, wishlist and the
                theme switch. The account, sign-out and cart icons are for the desktop header. */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSearchOpen(true)}
                className="flex h-10 items-center gap-2 rounded-full px-3 text-muted-foreground transition hover:bg-surface-2"
                aria-label="Search"
              >
                <Search className="h-[18px] w-[18px]" />
                <span className="hidden md:inline text-xs">Search</span>
                <kbd className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded bg-surface-2 border border-border">
                  ⌘K
                </kbd>
              </button>
              {user ? (
                <>
                  <a
                    href="/account"
                    className="hidden lg:grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2 transition"
                    aria-label="My account"
                  >
                    <User className="h-[18px] w-[18px]" />
                  </a>
                  <button
                    onClick={async () => {
                      await signOut();
                      navigate({ to: "/" });
                    }}
                    className="hidden lg:grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2 transition"
                    aria-label="Sign out"
                    title={user.email ?? "Sign out"}
                  >
                    <LogOut className="h-[18px] w-[18px]" />
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  className="hidden lg:grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2 transition"
                  aria-label="Sign in"
                >
                  <User className="h-[18px] w-[18px]" />
                </Link>
              )}
              <Link
                to="/wishlist"
                className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2 transition"
                aria-label="Wishlist"
              >
                <Heart className="h-[18px] w-[18px]" />
                {wish.ids.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-accent text-[10px] font-bold text-accent-foreground grid place-items-center">
                    {wish.ids.length}
                  </span>
                )}
              </Link>
              <button
                onClick={cart.open}
                className="relative hidden lg:grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2 transition"
                aria-label="Cart"
              >
                <ShoppingBag className="h-[18px] w-[18px]" />
                {mounted && cart.totalCount() > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground grid place-items-center">
                    {cart.totalCount()}
                  </span>
                )}
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function NavItem({
  to,
  label,
  exact,
}: {
  to: "/" | "/about" | "/blog" | "/contact";
  label: string;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: !!exact }}
      className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition"
      activeProps={{ className: "!text-foreground" }}
    >
      {label}
    </Link>
  );
}

function DropdownTrigger({
  label,
  active,
  onEnter,
  isOpen,
  children,
}: {
  label: string;
  active: boolean;
  onEnter: () => void;
  isOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative" onMouseEnter={onEnter}>
      <button
        className={`flex items-center gap-1 px-3 py-2 text-sm font-medium transition ${
          active || isOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {label}
        <ChevronDown
          className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-180 text-primary" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3">
          <div className="glass rounded-2xl border border-border/60 shadow-2xl overflow-hidden">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
