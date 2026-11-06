// Supabase Auth error messages are written for developers. Map the ones customers actually
// hit to something helpful; anything else falls through unchanged.

export type OAuthProvider = "google" | "apple";

const PROVIDER_NAME: Record<OAuthProvider, string> = { google: "Google", apple: "Apple" };

export function friendlyAuthError(err: unknown, provider?: OAuthProvider): string {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (/invalid login credentials/i.test(message)) {
    return "That email and password don't match. Check them and try again, or reset your password.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Please confirm your email first — check your inbox (and spam folder) for our message.";
  }
  if (/already (been )?registered|already exists/i.test(message)) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (/rate limit|too many|security purposes/i.test(message)) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (/provider is not enabled|unsupported provider/i.test(message)) {
    const who = provider ? PROVIDER_NAME[provider] : "That";
    return `${who} sign-in isn't available yet. Please use your email for now.`;
  }
  if (/access_denied|denied|cancel/i.test(message) && provider) {
    return `${PROVIDER_NAME[provider]} sign-in was cancelled.`;
  }
  return message || "Something went wrong. Please try again.";
}
