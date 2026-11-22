import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGrantAdmin } from "@/lib/queries/team";

export function AddAdminDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const grant = useGrantAdmin();

  function handleOpenChange(next: boolean) {
    if (!next) {
      setEmail("");
      setError(null);
    }
    onOpenChange(next);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    grant.mutate(email.trim(), {
      onSuccess: () => {
        toast.success("Admin added.");
        handleOpenChange(false);
      },
      onError: (err) => setError(err instanceof Error ? err.message : "Could not add that admin."),
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="glass border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display font-bold">Add an admin</DialogTitle>
          <DialogDescription>
            They need an account with a confirmed email address. They get full admin access straight
            away, and you can suspend or remove it at any time.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="add-admin-email"
              className="text-xs font-semibold text-muted-foreground"
            >
              Their email address
            </label>
            <input
              id="add-admin-email"
              type="email"
              required
              autoFocus
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "add-admin-error" : undefined}
              className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
            />
            {error && (
              <p id="add-admin-error" role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={grant.isPending}
              className="rounded-full bg-surface-2 px-5 py-2.5 text-sm font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={grant.isPending || email.trim() === ""}
              className="rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold disabled:opacity-60"
            >
              {grant.isPending ? "Adding…" : "Add admin"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
