import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Phone, Loader2, MailCheck, Wine, Package, Heart, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthField } from "@/components/auth/AuthField";
import { PasswordField } from "@/components/auth/PasswordField";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { friendlyAuthError } from "@/lib/auth-errors";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { isPlausiblePhone, storablePhone } from "@/lib/phone";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Finkel Reserve" }] }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot" | "check-email";

// Seconds before "Resend email" can be used again (Supabase rate-limits confirmation emails).
const RESEND_COOLDOWN = 30;

const PRIMARY_BUTTON =
  "w-full py-4 rounded-full bg-primary text-primary-foreground font-bold hover:shadow-glow transition disabled:opacity-50 inline-flex items-center justify-center gap-2";

const BENEFITS = [
  { icon: Package, text: "Track every order from cellar to doorstep" },
  { icon: Truck, text: "Faster checkout with saved addresses" },
  { icon: Heart, text: "Save your favourites and reorder in a tap" },
  { icon: Wine, text: "Buy by the box and save" },
];

function AuthPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  // If the customer cancelled at Google/Apple (or the provider refused), Supabase sends them
  // back with the reason in the URL. Show it instead of silently dropping them on the form.
  useEffect(() => {
    const params = new URLSearchParams(
      window.location.hash.replace(/^#/, "") || window.location.search,
    );
    const description = params.get("error_description") ?? params.get("error");
    if (description) {
      setError(friendlyAuthError(new Error(description.replace(/\+/g, " "))));
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setResetSent(false);
    setNeedsConfirm(false);
  };

  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  // Returns the first problem with the sign-up form, or null. Checked in the browser for a
  // fast, specific message — Supabase still enforces its own rules server-side.
  const validateSignup = (): string | null => {
    if (!firstName.trim()) return "Please enter your first name.";
    if (!lastName.trim()) return "Please enter your last name.";
    if (phone.trim() && !isPlausiblePhone(phone)) {
      return "Please enter a valid phone number, e.g. 0803 123 4567.";
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (password !== confirmPassword) return "Passwords don't match.";
    if (!ageConfirmed) return "Please confirm you are 18 or older and accept the terms.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setNeedsConfirm(false);

    if (mode === "signup") {
      const problem = validateSignup();
      if (problem) return setError(problem);
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const first = firstName.trim();
        const last = lastName.trim();
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            // Read by the handle_new_user trigger, which copies these onto the profile.
            data: {
              first_name: first,
              last_name: last,
              full_name: `${first} ${last}`,
              display_name: `${first} ${last}`,
              phone: storablePhone(phone) ?? undefined,
              age_confirmed_at: new Date().toISOString(),
            },
          },
        });
        if (error) throw error;

        // With email confirmation on, signing up an address that already has an account does
        // NOT error (that would reveal who is registered) — it returns a user with no
        // identities. Tell the person plainly and send them to sign in.
        if (data.user && (data.user.identities?.length ?? 1) === 0) {
          setMode("signin");
          setError(
            "An account with this email already exists. Sign in instead, or reset your password.",
          );
          return;
        }
        // Confirmation disabled in Supabase → already signed in; the effect above redirects.
        if (data.session) return;

        setPendingEmail(email.trim());
        setCooldown(RESEND_COOLDOWN);
        setMode("check-email");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      const message = friendlyAuthError(err);
      setError(message);
      if (/confirm your email/i.test(message)) setNeedsConfirm(true);
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async (address: string) => {
    if (!address || cooldown > 0) return;
    setError(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: address,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) return setError(friendlyAuthError(error));
    setCooldown(RESEND_COOLDOWN);
    setInfo(`We sent another email to ${address}.`);
  };

  // Supabase's resetPasswordForEmail intentionally returns success whether
  // or not the address has an account (anti-enumeration, built in) — so
  // showing the same "check your email" message on any non-error response
  // is already correct, not something extra to special-case here.
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      setError(friendlyAuthError(error));
      return;
    }
    setResetSent(true);
  };

  const isSignup = mode === "signup";

  return (
    <Layout>
      <div className="pt-28 md:pt-32" />
      <div className="mx-auto grid max-w-[1100px] grid-cols-1 items-stretch gap-8 px-4 pb-16 sm:px-6 md:grid-cols-2 md:gap-10 md:px-10">
        {/* Brand panel — desktop only; no hotlinked photo, so it can never show the wrong thing. */}
        <div className="relative hidden overflow-hidden rounded-3xl bg-wine p-10 text-primary-foreground md:flex md:flex-col md:justify-between">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
          />
          <p className="relative text-xs uppercase tracking-[0.3em] text-accent">
            — Finkel Reserve
          </p>
          <div className="relative">
            <h2 className="font-display text-4xl font-black leading-tight">
              Fine wines, whiskeys &amp; beverages, delivered.
            </h2>
            <ul className="mt-8 space-y-4">
              {BENEFITS.map(({ icon: Icon, text }) => (
                <li
                  key={text}
                  className="flex items-center gap-3 text-sm text-primary-foreground/90"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10">
                    <Icon className="h-4 w-4" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="glass min-w-0 rounded-3xl p-5 sm:p-8 md:p-10">
          {(mode === "signin" || mode === "signup") && (
            <div className="mb-6 flex w-fit max-w-full items-center gap-1 rounded-full bg-surface-2 p-1">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition sm:px-5 ${
                    mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {mode === "check-email" && (
                <div className="space-y-4 text-center">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
                    <MailCheck className="h-7 w-7" />
                  </span>
                  <h1 className="font-display text-3xl font-black tracking-tighter">
                    Check your email.
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    We sent a confirmation link to{" "}
                    <strong className="break-all text-foreground">{pendingEmail}</strong>. Open it
                    to activate your account, then sign in. It can take a minute — check your spam
                    folder too.
                  </p>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                  {info && <p className="text-xs text-primary">{info}</p>}
                  <button
                    type="button"
                    onClick={() => resendConfirmation(pendingEmail)}
                    disabled={cooldown > 0}
                    className="w-full rounded-full border border-border py-3 text-sm font-semibold transition hover:border-foreground/40 disabled:opacity-50"
                  >
                    {cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend email"}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                  >
                    ← Back to sign in
                  </button>
                </div>
              )}

              {mode === "forgot" && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <h1 className="font-display text-3xl font-black tracking-tighter">
                    Reset your password.
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Enter your email and we'll send you a link to set a new one.
                  </p>
                  <AuthField
                    icon={Mail}
                    placeholder="you@email.com"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
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
                  <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {busy ? "Sending…" : "Send reset link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
                  >
                    ← Back to sign in
                  </button>
                </form>
              )}

              {(mode === "signin" || mode === "signup") && (
                <div className="space-y-5">
                  <div>
                    <h1 className="font-display text-3xl font-black tracking-tighter">
                      {isSignup ? "Create your account." : "Welcome back."}
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {isSignup
                        ? "Takes a minute. Get 10% off your first order."
                        : "Sign in to track your orders and check out faster."}
                    </p>
                  </div>

                  <SocialAuthButtons onError={setError} disabled={busy} />

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="h-px flex-1 bg-border" />
                    or {isSignup ? "sign up" : "sign in"} with email
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {isSignup && (
                      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                        <AuthField
                          placeholder="First name"
                          type="text"
                          autoComplete="given-name"
                          required
                          maxLength={60}
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                        />
                        <AuthField
                          placeholder="Last name"
                          type="text"
                          autoComplete="family-name"
                          required
                          maxLength={60}
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                        />
                      </div>
                    )}

                    <AuthField
                      icon={Mail}
                      placeholder="you@email.com"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />

                    {isSignup && (
                      <AuthField
                        icon={Phone}
                        placeholder="Phone (optional) — for delivery updates"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        maxLength={20}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    )}

                    <PasswordField
                      placeholder={
                        isSignup ? `Create a password (min ${MIN_PASSWORD_LENGTH})` : "Password"
                      }
                      aria-label="Password"
                      autoComplete={isSignup ? "new-password" : "current-password"}
                      required
                      minLength={isSignup ? MIN_PASSWORD_LENGTH : undefined}
                      showStrength={isSignup}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />

                    {isSignup && (
                      <div>
                        <PasswordField
                          placeholder="Confirm password"
                          aria-label="Confirm password"
                          autoComplete="new-password"
                          required
                          invalid={passwordsMismatch}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        {passwordsMismatch && (
                          <p className="mt-1.5 px-1 text-xs text-destructive" role="alert">
                            Passwords don't match.
                          </p>
                        )}
                      </div>
                    )}

                    {isSignup && (
                      <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={ageConfirmed}
                          onChange={(e) => setAgeConfirmed(e.target.checked)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                        />
                        <span>
                          I am 18 or older and I agree to the{" "}
                          <Link to="/terms" className="underline">
                            Terms
                          </Link>{" "}
                          and{" "}
                          <Link to="/privacy" className="underline">
                            Privacy Policy
                          </Link>
                          .
                        </span>
                      </label>
                    )}

                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => switchMode("forgot")}
                        className="-mt-1 block text-xs text-muted-foreground hover:text-primary"
                      >
                        Forgot password?
                      </button>
                    )}

                    {error && (
                      <p className="text-xs text-destructive" role="alert">
                        {error}
                      </p>
                    )}
                    {needsConfirm && (
                      <button
                        type="button"
                        onClick={() => resendConfirmation(email.trim())}
                        disabled={cooldown > 0 || !email.trim()}
                        className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                      >
                        {cooldown > 0
                          ? `Resend confirmation in ${cooldown}s`
                          : "Resend confirmation email"}
                      </button>
                    )}
                    {info && <p className="text-xs text-primary">{info}</p>}

                    <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                      {isSignup ? "Create account" : "Sign in"}
                    </button>
                  </form>

                  <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                    {isSignup
                      ? "Signing up with Google or Apple? By continuing you confirm you are 18 or older and agree to our "
                      : "By continuing you confirm you are 18 or older and agree to our "}
                    <Link to="/terms" className="underline">
                      Terms
                    </Link>
                    .
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
