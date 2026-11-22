import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { EmptyState } from "./EmptyState";

// Screen-level convenience only. The real check lives inside every team database function,
// which raises unless the caller is a super admin, so a hand-made request gets the same answer.
export function SuperAdminGate({ children }: { children: ReactNode }) {
  const { isSuperAdmin, loading, rolesLoading } = useAuth();

  if (loading || rolesLoading) {
    return (
      <div className="grid place-items-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Super admin only"
        description="Managing the admin team is limited to the owner account."
        action={
          <Link to="/admin" className="rounded-full bg-surface-2 px-5 py-2.5 text-sm font-bold">
            Back to overview
          </Link>
        }
      />
    );
  }

  return <>{children}</>;
}
