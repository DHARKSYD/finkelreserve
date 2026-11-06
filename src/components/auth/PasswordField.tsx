import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { passwordStrength } from "@/lib/password";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value"> & {
  value: string;
  /** Show the 4-segment strength meter under the field (for NEW passwords). */
  showStrength?: boolean;
  /** Mark the field as failing validation (red ring + aria-invalid). */
  invalid?: boolean;
  /** "pill" (default) matches the sign-in screens; "field" is the rounded-rectangle used in forms. */
  shape?: "pill" | "field";
  /** Show the padlock icon (pill only). */
  icon?: boolean;
};

const SEGMENT_COLOUR = [
  "",
  "bg-destructive",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-emerald-600",
] as const;

// A password input with a show/hide toggle. Used on sign-in, sign-up (password + confirm),
// reset-password and the account security page, so they all behave the same.
export function PasswordField({
  showStrength,
  invalid,
  className,
  value,
  shape = "pill",
  icon = shape === "pill",
  ...props
}: Props) {
  const [visible, setVisible] = useState(false);
  const strength = passwordStrength(value);

  return (
    <div>
      <div
        className={`flex items-center gap-3 bg-input ${
          shape === "pill" ? "rounded-full px-5" : "rounded-lg pl-4 pr-2"
        } ${invalid ? "ring-2 ring-destructive" : "focus-within:ring-2 focus-within:ring-primary"}`}
      >
        {icon && <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
        <input
          {...props}
          value={value}
          type={visible ? "text" : "password"}
          aria-invalid={invalid || undefined}
          // Keep the mobile keyboard from capitalising or "correcting" a password.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${
            shape === "pill" ? "py-4" : "py-2.5"
          } ${className ?? ""}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // Don't steal focus from the input on tap — keeps the keyboard open on phones.
          onMouseDown={(e) => e.preventDefault()}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:text-foreground ${
            shape === "pill" ? "-mr-2" : ""
          }`}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {showStrength && value.length > 0 && (
        <div className="mt-2 px-1" aria-live="polite">
          <div className="flex gap-1.5" aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= strength.score ? SEGMENT_COLOUR[strength.score] : "bg-border"
                }`}
              />
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Password strength: <span className="font-semibold">{strength.label}</span>
          </p>
        </div>
      )}
    </div>
  );
}
