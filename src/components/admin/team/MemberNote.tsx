import { useState } from "react";
import { toast } from "sonner";
import { useSetAdminNote, type TeamMember } from "@/lib/queries/team";

const MAX = 2000;

// A private note about one team member. Only super admins can read or write it: the column sits
// in admin_members, which ordinary admins cannot read.
export function MemberNote({ member }: { member: TeamMember }) {
  const [value, setValue] = useState(member.note ?? "");
  const save = useSetAdminNote();
  const dirty = value.trim() !== (member.note ?? "").trim();

  function handleSave() {
    save.mutate(
      { userId: member.userId, note: value },
      {
        onSuccess: () => toast.success("Note saved."),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Could not save the note."),
      },
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor="member-note" className="text-xs font-semibold text-muted-foreground">
        Private note (only super admins can see this)
      </label>
      <textarea
        id="member-note"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={MAX}
        rows={4}
        placeholder="For example: covers weekend orders, still learning refunds."
        className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary resize-y"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {value.length}/{MAX}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || save.isPending}
          className="rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm font-bold disabled:opacity-60"
        >
          {save.isPending ? "Saving…" : "Save note"}
        </button>
      </div>
    </div>
  );
}
