import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Package,
  Heart,
  MapPin,
  RotateCcw,
  ChevronRight,
  User,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/lib/queries/profile";
import { useMyOrders } from "@/lib/queries/orders";
import { useMyReturns } from "@/lib/queries/returns";
import { useMyAddresses } from "@/lib/queries/addresses";
import { useWishlist } from "@/lib/store";
import { formatNGN } from "@/lib/currency";
import { ReturnStatusBadge } from "@/components/admin/StatusBadge";

export const Route = createFileRoute("/account/")({
  head: () => ({ meta: [{ title: "My Account" }] }),
  component: OverviewPage,
});

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  processing: "bg-primary/10 text-primary",
  shipped: "bg-blue-500/10 text-blue-400",
  delivered: "bg-green-500/10 text-green-500",
  cancelled: "bg-destructive/10 text-destructive",
};

function OverviewPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: profile } = useMyProfile(user?.id);
  const { data: orders = [] } = useMyOrders();
  const { data: returns = [] } = useMyReturns();
  const { data: addresses = [] } = useMyAddresses();
  const { ids: wishlistIds } = useWishlist();

  if (!user) return null;

  const fullName: string =
    profile?.displayName ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? "Customer";
  const firstName = profile?.firstName ?? fullName.split(" ")[0];
  // Google/Apple sign-ups can arrive without a name (Apple shares it once, and not always).
  const needsName = !!profile && !profile.firstName && !profile.lastName;
  const recentOrders = orders.slice(0, 3);
  const activeReturns = returns.filter((r) => !["completed", "rejected"].includes(r.status));

  return (
    <div className="space-y-6">
      {/* Phone only: who you're signed in as (the desktop sidebar already shows this). */}
      <div className="glass flex items-center gap-3 rounded-2xl p-4 md:hidden">
        {profile?.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-bold text-primary">
            {fullName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{fullName}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>

      {needsName && (
        <Link
          to="/account/profile"
          className="glass flex items-center justify-between gap-3 rounded-2xl border border-primary/30 p-4 text-sm"
        >
          <span className="min-w-0">
            <span className="block font-semibold">Add your name</span>
            <span className="block text-xs text-muted-foreground">
              So your deliveries and reviews show the right name.
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
        </Link>
      )}

      <div>
        <h2 className="font-display font-bold text-xl">Welcome back, {firstName}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {orders.length} order{orders.length !== 1 ? "s" : ""} placed
          {activeReturns.length > 0 &&
            ` · ${activeReturns.length} return${activeReturns.length !== 1 ? "s" : ""} in progress`}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          to="/account/orders"
          icon={Package}
          label="Orders"
          value={String(orders.length)}
        />
        <SummaryCard
          to="/account/wishlist"
          icon={Heart}
          label="Wishlist"
          value={String(wishlistIds.length)}
        />
        <SummaryCard
          to="/account/addresses"
          icon={MapPin}
          label="Addresses"
          value={String(addresses.length)}
        />
        <SummaryCard
          to="/account/returns"
          icon={RotateCcw}
          label="Returns"
          value={String(returns.length)}
        />
      </div>

      {activeReturns.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <p className="text-sm font-semibold mb-3">Active returns</p>
          <div className="space-y-2">
            {activeReturns.map((r) => (
              <Link
                key={r.id}
                to="/account/returns"
                className="flex items-center justify-between text-sm hover:text-primary transition"
              >
                <span className="text-muted-foreground">
                  Order #{r.orderId.slice(0, 8).toUpperCase()}
                </span>
                <ReturnStatusBadge status={r.status} />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Recent orders</p>
          {orders.length > 0 && (
            <Link to="/account/orders" className="text-xs font-bold text-primary hover:underline">
              View all
            </Link>
          )}
        </div>

        {recentOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No orders yet —{" "}
            <Link to="/shop" className="text-primary hover:underline">
              start shopping
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-1">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                to="/order-confirmation/$id"
                params={{ id: order.id }}
                className="flex items-center justify-between gap-3 py-2.5 border-b border-border/60 last:border-0 group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {order.items[0]?.name}
                    {order.items.length > 1 && ` + ${order.items.length - 1} more`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString("en-NG")} ·{" "}
                    {formatNGN(order.total)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[order.status] ?? "bg-surface-2 text-muted-foreground"}`}
                  >
                    {order.status}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Phone only: the sections that aren't among the four cards above, plus sign out. */}
      <div className="glass divide-y divide-border/60 overflow-hidden rounded-2xl md:hidden">
        <MenuRow
          to="/account/profile"
          icon={User}
          label="Profile"
          hint="Name, phone, photo, email"
        />
        <MenuRow
          to="/account/security"
          icon={ShieldCheck}
          label="Security"
          hint="Password and account deletion"
        />
        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium text-muted-foreground transition hover:text-destructive"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );
}

function MenuRow({
  to,
  icon: Icon,
  label,
  hint,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface-2/60">
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
    </Link>
  );
}

function SummaryCard({
  to,
  icon: Icon,
  label,
  value,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Link to={to} className="glass rounded-2xl p-4 hover:border-primary/30 transition">
      <Icon className="h-4 w-4 text-primary mb-2" />
      <p className="font-display font-black text-2xl">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Link>
  );
}
