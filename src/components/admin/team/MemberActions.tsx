import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useSetAdminStatus, type TeamMember, type TeamStatus } from "@/lib/queries/team";

type Pending = {
  status: TeamStatus;
  title: string;
  description: string;
  label: string;
  ok: string;
};

function copyFor(member: TeamMember, status: TeamStatus): Pending {
  const name = member.name;
  switch (status) {
    case "suspended":
      return {
        status,
        title: `Suspend ${name}?`,
        description:
          "They lose all admin access straight away, on every screen. Their history stays on record and you can reactivate them later.",
        label: "Suspend",
        ok: "Admin suspended.",
      };
    case "removed":
      return {
        status,
        title: `Remove ${name}'s access?`,
        description:
          "They lose all admin access straight away and are marked as removed from the team. Their history stays on record and you can add them back later.",
        label: "Remove access",
        ok: "Admin removed.",
      };
    default:
      return {
        status,
        title: `Reactivate ${name}?`,
        description: "They get full admin access back straight away.",
        label: "Reactivate",
        ok: "Admin reactivated.",
      };
  }
}

export function MemberActions({ member }: { member: TeamMember }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const setStatus = useSetAdminStatus();

  // The database refuses to change a super admin or your own access, so the buttons are not shown.
  if (member.isSuperAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Super admins cannot be changed here. Their access is managed directly in the database.
      </p>
    );
  }

  function confirm() {
    if (!pending) return;
    const action = pending;
    setStatus.mutate(
      { userId: member.userId, status: action.status },
      {
        onSuccess: () => {
          toast.success(action.ok);
          setPending(null);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Could not change that admin's access.");
          setPending(null);
        },
      },
    );
  }

  const canSuspend = member.status === "active";
  const canRemove = member.status !== "removed";
  const canReactivate = member.status !== "active";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canReactivate && (
          <button
            type="button"
            onClick={() => setPending(copyFor(member, "active"))}
            className="rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold"
          >
            Reactivate
          </button>
        )}
        {canSuspend && (
          <button
            type="button"
            onClick={() => setPending(copyFor(member, "suspended"))}
            className="rounded-full bg-surface-2 px-5 py-2.5 text-sm font-bold"
          >
            Suspend
          </button>
        )}
        {canRemove && (
          <button
            type="button"
            onClick={() => setPending(copyFor(member, "removed"))}
            className="rounded-full bg-destructive/15 text-destructive px-5 py-2.5 text-sm font-bold"
          >
            Remove access
          </button>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending?.title ?? ""}
        description={pending?.description ?? ""}
        confirmLabel={pending?.label}
        destructive={pending?.status !== "active"}
        loading={setStatus.isPending}
        onConfirm={confirm}
      />
    </>
  );
}
