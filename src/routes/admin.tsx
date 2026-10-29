import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { AdminLayout } from "@/components/admin/AdminLayout";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Finkel Reserve" }] }),
  component: AdminGate,
});

// The 4 states below are the actual access boundary from the user's point
// of view, but NOT the security boundary — isAdmin here is a plain client
// read of the caller's own user_roles row, used only to decide what to
// render. Every table an admin page touches enforces authorization again,
// independently, via RLS (has_role checks) or — where a mutation needs to
// bypass RLS, like cancelling an order — a server function that
// re-verifies admin status itself (see requireAdmin in lib/actions/auth.ts).
// A client that skipped this UI entirely and called the API directly would
// hit the same checks.
function AdminGate() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <Layout>
        <div className="pt-40 grid place-items-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="pt-40 max-w-md mx-auto text-center px-6">
          <ShieldAlert className="h-10 w-10 text-primary mx-auto" />
          <h1 className="mt-4 font-display font-black text-3xl">Sign in required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The admin dashboard is for staff accounts only.
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-block rounded-full bg-primary text-primary-foreground px-6 py-3 font-bold"
          >
            Sign in
          </Link>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="pt-40 max-w-md mx-auto text-center px-6">
          <ShieldAlert className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="mt-4 font-display font-black text-3xl">No access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account ({user.email}) is not an admin. Ask an existing admin to grant you the
            role.
          </p>
          <Link to="/" className="mt-6 inline-block rounded-full bg-surface-2 px-6 py-3 font-bold">
            Back home
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}
