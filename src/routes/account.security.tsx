import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useMyOrders } from "@/lib/queries/orders";
import { useMyReturns } from "@/lib/queries/returns";
import { DeleteAccountDialog } from "@/components/account/DeleteAccountDialog";

export const Route = createFileRoute("/account/security")({
  head: () => ({ meta: [{ title: "Security — My Account" }] }),
  component: SecurityPage,
});

function SecurityPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Client-side eligibility check — purely for a helpful, immediate
  // message before the dialog even opens. deleteMyAccount re-checks both
  // of these itself server-side; that's the actual boundary, this is UX.
  const { data: orders = [] } = useMyOrders();
  const { data: returns = [] } = useMyReturns();
  const openOrders = orders.filter((o) => !["delivered", "cancelled"].includes(o.status));
  const openReturns = returns.filter((r) => !["rejected", "completed"].includes(r.status));
  const canDelete = openOrders.length === 0 && openReturns.length === 0;

  if (!user) return null;

  const hasPassword = (user.identities ?? []).some((i) => i.provider === "email");

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    // Supabase Auth verifies and hashes this itself — the raw password never
    // touches our database, only the current authenticated session's token.
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated.");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display font-bold text-lg">Security</h2>

      <div className="glass rounded-2xl p-6">
        <p className="text-xs font-semibold text-muted-foreground mb-1">Signed in as</p>
        <p className="text-sm mb-4">{user.email}</p>
        {user.created_at && (
          <>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Account created</p>
            <p className="text-sm">{new Date(user.created_at).toLocaleDateString("en-NG")}</p>
          </>
        )}
      </div>

      <div className="glass rounded-2xl p-6">
        <p className="font-semibold text-sm mb-4">Change password</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Confirm new password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
            />
          </div>
        </div>
        <button
          onClick={handlePasswordChange}
          disabled={submitting || !newPassword}
          className="mt-4 rounded-full bg-primary text-primary-foreground px-6 py-2.5 text-sm font-bold disabled:opacity-60"
        >
          {submitting ? "Updating…" : "Update Password"}
        </button>
      </div>

      <div className="glass rounded-2xl p-6 sm:hidden">
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
          className="w-full flex items-center justify-center gap-2 rounded-full bg-destructive/10 text-destructive px-6 py-2.5 text-sm font-bold"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>

      <div className="glass rounded-2xl p-6 border border-destructive/20">
        <p className="font-semibold text-sm text-destructive mb-1">Danger Zone</p>
        <p className="text-xs text-muted-foreground mb-4">
          Permanently delete your account, profile, and saved addresses.
        </p>
        {!canDelete && (
          <p className="text-xs text-muted-foreground mb-3">
            {openOrders.length > 0 &&
              `You have ${openOrders.length} order${openOrders.length === 1 ? "" : "s"} still in progress. `}
            {openReturns.length > 0 &&
              `You have ${openReturns.length} return${openReturns.length === 1 ? "" : "s"} still in progress. `}
            <Link to="/contact" className="underline">
              Contact us
            </Link>{" "}
            if you need help.
          </p>
        )}
        <button
          onClick={() => setDeleteOpen(true)}
          disabled={!canDelete}
          className="rounded-full border border-destructive/40 text-destructive px-5 py-2.5 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-destructive/5 transition"
        >
          Delete Account
        </button>
        <DeleteAccountDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          hasPassword={hasPassword}
        />
      </div>
    </div>
  );
}
