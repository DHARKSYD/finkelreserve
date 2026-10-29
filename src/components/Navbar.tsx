import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Heart,
  Search,
  ShoppingBag,
  User,
  Menu,
  X,
  LayoutDashboard,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useCart, useWishlist } from "@/lib/store";
import { useAuth } from "@/hooks/use-auth";
import { SearchModal } from "./SearchModal";
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
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menu, setMenu] = useState<MenuKey>(null);
  const cart = useCart();
  const wish = useWishlist();
  const { user, isAdmin, signOut } = useAuth();
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
    setOpen(false);
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

            <div className="flex items-center gap-1">
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 h-10 rounded-full hover:bg-surface-2 transition text-muted-foreground"
                aria-label="Search"
              >
                <Search className="h-[18px] w-[18px]" />
                <span className="hidden md:inline text-xs">Search</span>
                <kbd className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded bg-surface-2 border border-border">
                  ⌘K
                </kbd>
              </button>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="hidden sm:grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2 transition"
                  aria-label="Admin"
                >
                  <LayoutDashboard className="h-[18px] w-[18px]" />
                </Link>
              )}
              {user ? (
                <>
                  {/* Account icon — links to /account when signed in */}
                  <a
                    href="/account"
                    className="hidden sm:grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2 transition"
                    aria-label="My account"
                  >
                    <User className="h-[18px] w-[18px]" />
                  </a>
                  <button
                    onClick={async () => {
                      await signOut();
                      navigate({ to: "/" });
                    }}
                    className="hidden sm:grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2 transition"
                    aria-label="Sign out"
                    title={user.email ?? "Sign out"}
                  >
                    <LogOut className="h-[18px] w-[18px]" />
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  className="hidden sm:grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2 transition"
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
                className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2 transition"
                aria-label="Cart"
              >
                <ShoppingBag className="h-[18px] w-[18px]" />
                {mounted && cart.totalCount() > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground grid place-items-center">
                    {cart.totalCount()}
                  </span>
                )}
              </button>
              <button
                onClick={() => setOpen((v) => !v)}
                className="lg:hidden grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2 transition"
                aria-label="Menu"
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-all ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        />
        <div
          className={`absolute right-0 top-0 h-full w-[82%] max-w-sm bg-surface border-l border-border p-6 pt-24 overflow-y-auto transition-transform ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <button
            onClick={() => {
              setOpen(false);
              setSearchOpen(true);
            }}
            className="w-full flex items-center gap-2 mb-4 px-4 py-3 rounded-full bg-surface-2"
          >
            <Search className="h-4 w-4" /> <span className="text-sm">Search…</span>
          </button>
          <nav className="flex flex-col gap-1">
            <Link
              to="/"
              className="px-4 py-3 text-xl font-display font-bold border-b border-border/40"
            >
              Home
            </Link>
            <Link
              to="/shop"
              className="px-4 py-3 text-xl font-display font-bold border-b border-border/40"
            >
              Shop
            </Link>
            <Link
              to="/about"
              className="px-4 py-3 text-xl font-display font-bold border-b border-border/40"
            >
              Our Story
            </Link>
            <Link
              to="/blog"
              className="px-4 py-3 text-xl font-display font-bold border-b border-border/40"
            >
              Wine Guide
            </Link>
            <Link
              to="/contact"
              className="px-4 py-3 text-xl font-display font-bold border-b border-border/40"
            >
              Contact
            </Link>
            <Link to="/admin" className="px-4 py-3 text-base text-muted-foreground">
              Admin
            </Link>
            {user ? (
              <a href="/account" className="px-4 py-3 text-base text-muted-foreground">
                My account
              </a>
            ) : (
              <Link to="/auth" className="px-4 py-3 text-base text-muted-foreground">
                Sign in
              </Link>
            )}
            <Link to="/wishlist" className="px-4 py-3 text-base text-muted-foreground">
              Wishlist
            </Link>
            <div className="mt-3 pt-3 border-t border-border/40">
              <p className="px-4 text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
                Shop by type
              </p>
              <div className="grid grid-cols-2 gap-1 px-2">
                {QUICK.map((q) => (
                  <Link
                    key={q.type}
                    to="/shop"
                    search={{ type: q.type }}
                    className="px-2 py-1.5 text-xs truncate hover:text-primary"
                  >
                    {q.label}
                  </Link>
                ))}
              </div>
            </div>
          </nav>
        </div>
      </div>

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
