import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Finkel Reserve" }] }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        setInfo("Check your email to confirm your account, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  // Supabase's resetPasswordForEmail intentionally returns success whether
  // or not the address has an account (anti-enumeration, built in) — so
  // showing the same "check your email" message on any non-error response
  // is already correct, not something extra to special-case here.
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setResetSent(true);
  };

  const handleGoogle = async () => {
    setError(null);
    // Requires the Google provider to be configured in your Supabase
    // project's Auth settings (Authentication → Providers → Google).
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
  };

  return (
    <Layout>
      <div className="pt-32" />
      <div className="mx-auto max-w-[1100px] px-6 md:px-10 grid md:grid-cols-2 gap-10 items-center">
        <div className="hidden md:block relative aspect-[4/5] rounded-3xl overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1200&q=80"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          <div className="absolute bottom-8 left-8 right-8">
            <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono">
              — Members only
            </p>
            <h2 className="mt-3 font-display font-black text-4xl">Join the squad. Drops first.</h2>
          </div>
        </div>

        <div className="glass rounded-3xl p-8 md:p-10">
          {mode !== "forgot" && (
            <div className="flex items-center gap-1 p-1 bg-surface-2 rounded-full mb-7 w-fit">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setError(null);
                    setInfo(null);
                  }}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
                    mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              onSubmit={mode === "forgot" ? handleForgotPassword : handleSubmit}
              className="space-y-4"
            >
              {mode === "forgot" ? (
                <>
                  <h1 className="font-display font-black text-3xl tracking-tighter">
                    Reset your password.
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Enter your email and we'll send you a link to set a new one.
                  </p>

                  <Field
                    icon={Mail}
                    placeholder="you@email.com"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />

                  {error && <p className="text-xs text-destructive">{error}</p>}
                  {resetSent && (
                    <p className="text-xs text-primary">
                      Check your email for a link to reset your password.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-4 rounded-full bg-primary text-primary-foreground font-bold hover:shadow-glow transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {busy ? "Sending…" : "Send reset link"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setError(null);
                      setResetSent(false);
                    }}
                    className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
                  >
                    ← Back to sign in
                  </button>
                </>
              ) : (
                <>
                  <h1 className="font-display font-black text-3xl tracking-tighter">
                    {mode === "signin" ? "Welcome back." : "Create your account."}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {mode === "signin"
                      ? "Sign in to leave reviews and track your orders."
                      : "Get 10% off your first order."}
                  </p>

                  {mode === "signup" && (
                    <Field
                      icon={User}
                      placeholder="Full name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  )}
                  <Field
                    icon={Mail}
                    placeholder="you@email.com"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Field
                    icon={Lock}
                    placeholder="Password (min 8 chars)"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />

                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setError(null);
                        setInfo(null);
                        setResetSent(false);
                      }}
                      className="block text-xs text-muted-foreground hover:text-primary -mt-2"
                    >
                      Forgot password?
                    </button>
                  )}

                  {error && <p className="text-xs text-destructive">{error}</p>}
                  {info && <p className="text-xs text-primary">{info}</p>}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-4 rounded-full bg-primary text-primary-foreground font-bold hover:shadow-glow transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {mode === "signin" ? "Sign in" : "Create account"}
                  </button>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex-1 h-px bg-border" /> or{" "}
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogle}
                    className="w-full py-3 rounded-full border border-border hover:border-foreground/40 text-sm font-semibold"
                  >
                    Continue with Google
                  </button>

                  <p className="text-xs text-muted-foreground text-center">
                    By continuing you agree to our{" "}
                    <Link to="/terms" className="underline">
                      terms
                    </Link>
                    .
                  </p>
                </>
              )}
            </motion.form>
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}

function Field({
  icon: Icon,
  ...props
}: { icon: typeof Mail } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-center gap-3 bg-input rounded-full px-5">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <input {...props} className="flex-1 bg-transparent py-4 text-sm outline-none" />
    </div>
  );
}
