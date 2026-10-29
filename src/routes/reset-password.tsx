import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — Finkel Reserve" },
      // Private, single-use flow — never index.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // The recovery link from the email lands here with a token in the URL;
  // the Supabase client parses it automatically (detectSessionInUrl, on by
  // default) and fires PASSWORD_RECOVERY once that session is ready — only
  // then is it safe to call updateUser. getSession() covers the case where
  // the session was already established before this listener attached. If
  // neither fires within a few seconds, the link is treated as invalid/
  // expired rather than leaving the page stuck on "verifying" forever.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const timeout = setTimeout(() => setLinkInvalid(true), 6000);
    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/account" }), 2000);
  };

  return (
    <Layout>
      <div className="pt-32 pb-24">
        <div className="mx-auto max-w-md px-6">
          <div className="glass rounded-3xl p-8 md:p-10">
            <h1 className="font-display font-black text-3xl tracking-tighter mb-2">
              Set a new password
            </h1>

            {!ready && !done && !linkInvalid && (
              <p className="text-sm text-muted-foreground mt-4">Verifying your reset link…</p>
            )}

            {linkInvalid && !ready && !done && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-destructive">
                  This reset link is invalid or has expired.
                </p>
                <Link to="/auth" className="text-sm text-primary hover:underline">
                  Request a new one
                </Link>
              </div>
            )}

            {ready && !done && (
              <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                <div className="flex items-center gap-3 bg-input rounded-full px-5">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    placeholder="New password (min 8 chars)"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex-1 bg-transparent py-4 text-sm outline-none"
                  />
                </div>
                <div className="flex items-center gap-3 bg-input rounded-full px-5">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="flex-1 bg-transparent py-4 text-sm outline-none"
                  />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-4 rounded-full bg-primary text-primary-foreground font-bold hover:shadow-glow transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {busy ? "Saving…" : "Update password"}
                </button>
              </form>
            )}

            {done && (
              <p className="text-sm text-primary mt-4">
                Password updated — taking you to your account…
              </p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
