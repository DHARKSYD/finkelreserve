import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/actions/account";

export function DeleteAccountDialog({
  open,
  onOpenChange,
  hasPassword,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether this account has an email/password identity — Google-only
   *  accounts have nothing to re-check a password against. */
  hasPassword: boolean;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    confirmText.trim().toUpperCase() === "DELETE" && (!hasPassword || password.length > 0);

  const reset = () => {
    setConfirmText("");
    setPassword("");
  };

  const handleDelete = async () => {
    if (!user?.email || !canSubmit) return;
    setSubmitting(true);

    // Re-authentication: for password accounts, this both verifies the
    // password is actually correct *and* refreshes the session, so the
    // deleteMyAccount call right after carries a fresh token — not just a
    // UI gate. OAuth-only accounts have no password to re-check; their
    // still-active session is the equivalent signal, the same trust level
    // the password-change form on this same page already relies on.
    if (hasPassword) {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (reauthError) {
        toast.error("That password isn't correct.");
        setSubmitting(false);
        return;
      }
    }

    try {
      const result = await deleteMyAccount();
      if (!result.ok) {
        toast.error(result.error);
        setSubmitting(false);
        return;
      }

      // Clears the local session immediately so no protected route can read
      // it again, including via the browser Back button — the account
      // layout's own auth guard (redirects when !user) takes over on
      // whatever page they land on next.
      await signOut();
      toast.success("Your account has been deleted.");
      reset();
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete your account.");
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (submitting) return;
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="glass border-border">
        <DialogHeader>
          <div className="h-10 w-10 rounded-full bg-destructive/10 grid place-items-center mb-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <DialogTitle className="font-display font-bold">Delete your account</DialogTitle>
          <DialogDescription>
            This permanently deletes your profile, saved addresses, and sign-in — it can't be
            undone. Your past orders stay in our records (they're kept for business and legal
            reasons), but they're no longer linked to your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hasPassword && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Confirm your password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={submitting}
                className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-destructive disabled:opacity-60"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Type DELETE to confirm
            </label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              disabled={submitting}
              className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-destructive disabled:opacity-60"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={submitting}
            className="rounded-full bg-surface-2 px-5 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!canSubmit || submitting}
            className="rounded-full bg-destructive text-destructive-foreground px-5 py-2.5 text-sm font-bold disabled:opacity-60 inline-flex items-center gap-2"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? "Deleting…" : "Delete my account"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
