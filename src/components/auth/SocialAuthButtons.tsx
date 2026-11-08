import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError, type OAuthProvider } from "@/lib/auth-errors";

// Which social buttons to show. Defaults to both; set VITE_AUTH_PROVIDERS="google" (or "apple",
// or "") at build time to hide one you haven't configured in Supabase yet.
// A provider must ALSO be switched on in Supabase → Authentication → Providers — see
// DEPLOYMENT.md. If it isn't, tapping the button shows a friendly "isn't available yet".
const ENABLED: OAuthProvider[] = (import.meta.env.VITE_AUTH_PROVIDERS ?? "google,apple")
  .split(",")
  .map((s: string) => s.trim().toLowerCase())
  .filter((s: string): s is OAuthProvider => s === "google" || s === "apple");

export function GoogleLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function AppleLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

export function SocialAuthButtons({
  onError,
  disabled,
}: {
  onError: (message: string | null) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  if (ENABLED.length === 0) return null;

  const start = async (provider: OAuthProvider) => {
    onError(null);
    setBusy(provider);
    // On success the browser leaves for Google/Apple and then returns to /auth, where the
    // Supabase client picks the session up from the URL and the page forwards the customer
    // home. If they cancel, the reason lands in the URL and /auth shows it. (Add
    // https://<your-domain>/** to Supabase → Authentication → URL Configuration → Redirect URLs.)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) {
      setBusy(null);
      onError(friendlyAuthError(error, provider));
    }
  };

  const base =
    "flex w-full items-center justify-center gap-3 rounded-full px-5 py-3 text-sm font-semibold transition disabled:opacity-60";

  return (
    <div className="space-y-3">
      {ENABLED.includes("google") && (
        <button
          type="button"
          disabled={disabled || busy !== null}
          onClick={() => start("google")}
          // Google's brand rules: white surface, dark text, the colour "G" — in both themes.
          className={`${base} border border-border bg-white text-neutral-800 hover:bg-neutral-50`}
        >
          {busy === "google" ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleLogo />}
          Continue with Google
        </button>
      )}
      {ENABLED.includes("apple") && (
        <button
          type="button"
          disabled={disabled || busy !== null}
          onClick={() => start("apple")}
          // Apple's brand rules: black with a white logo, or white with a black one (we invert
          // in dark mode so it never disappears into the page).
          className={`${base} bg-black text-white hover:bg-neutral-800 dark:border dark:border-border dark:bg-white dark:text-black dark:hover:bg-neutral-200`}
        >
          {busy === "apple" ? <Loader2 className="h-5 w-5 animate-spin" /> : <AppleLogo />}
          Continue with Apple
        </button>
      )}
    </div>
  );
}
