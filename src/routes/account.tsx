import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/lib/queries/profile";
import { ACCOUNT_NAV } from "@/components/account/AccountNav";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Account — Finkel Reserve" },
      // Private page — never index
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AccountLayout,
});

function AccountLayout() {
  const { user, loading, signOut } = useAuth();
  const { data: profile } = useMyProfile(user?.id);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <Layout>
        <div className="pt-40 grid place-items-center text-muted-foreground text-sm">Loading…</div>
      </Layout>
    );
  }

  const displayName =
    profile?.displayName ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? "Customer";

  return (
    <Layout>
      <div className="pt-28 pb-24">
        <div className="mx-auto max-w-5xl px-6 md:px-10">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono mb-2">
              Account
            </p>
            <h1 className="font-display font-black text-4xl md:text-5xl tracking-tighter">
              My Account
            </h1>
          </div>

          <div className="grid md:grid-cols-[240px_1fr] gap-6 items-start">
            {/* Desktop sidebar */}
            <div className="hidden md:block glass rounded-2xl p-5 space-y-1 sticky top-24">
              <div className="flex items-center gap-3 px-2 pb-4 mb-2 border-b border-border/60">
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 grid place-items-center shrink-0 text-primary font-bold text-sm">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>

              {ACCOUNT_NAV.map(({ to, label, icon: Icon }) => {
                const active = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}

              <button
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition mt-1"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>

            {/* Mobile tab bar */}
            <div className="md:hidden -mx-6 px-6 overflow-x-auto">
              <div className="flex gap-2 pb-1 w-max min-w-full">
                {ACCOUNT_NAV.map(({ to, label, icon: Icon }) => {
                  const active = location.pathname === to;
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface-2 text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="min-w-0">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
