import { StatusBadge, type StatusTone } from "@/components/admin/StatusBadge";
import type { TeamStatus } from "@/lib/queries/team";
import { idleNote } from "./team-format";

const STATUS_TONE: Record<TeamStatus, StatusTone> = {
  active: "success",
  suspended: "warning",
  removed: "danger",
};

export function MemberStatusBadge({ status }: { status: TeamStatus }) {
  return <StatusBadge label={status} tone={STATUS_TONE[status]} />;
}

export function RoleBadge({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  return (
    <StatusBadge
      label={isSuperAdmin ? "super admin" : "admin"}
      tone={isSuperAdmin ? "success" : "neutral"}
    />
  );
}

// Shown next to the status for an active admin who has gone quiet.
export function IdleBadge({ member }: { member: Parameters<typeof idleNote>[0] }) {
  const note = idleNote(member);
  return note ? <StatusBadge label={note} tone="warning" /> : null;
}
