// Password rules and a small strength estimate, shared by sign-up, password reset and the
// account security page so they all agree. The ONLY hard rule is the minimum length — it
// matches what Supabase is configured to accept; the strength meter is advice, not a gate.

export const MIN_PASSWORD_LENGTH = 8;

export type PasswordStrength = {
  /** 0 = nothing typed yet, 1 = weak … 4 = strong */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
};

const COMMON = /^(?:12345678|123456789|1234567890|password\d*|qwerty\d*|letmein\d*|iloveyou\d*|admin\d*|welcome\d*|abc12345)$/i;

export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: "" };
  if (pw.length < MIN_PASSWORD_LENGTH) return { score: 1, label: "Too short" };
  if (COMMON.test(pw) || /^(.)\1+$/.test(pw)) return { score: 1, label: "Too common" };

  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  const total = variety + (pw.length >= 12 ? 1 : 0);
  if (total <= 1) return { score: 1, label: "Weak" };
  if (total === 2) return { score: 2, label: "Fair" };
  if (total === 3) return { score: 3, label: "Good" };
  return { score: 4, label: "Strong" };
}

/** Returns an error message, or null if the password is acceptable. */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirm) return "Passwords don't match.";
  return null;
}
