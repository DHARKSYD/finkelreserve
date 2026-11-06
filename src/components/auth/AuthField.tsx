import type { LucideIcon } from "lucide-react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  icon?: LucideIcon;
  invalid?: boolean;
};

// The pill-shaped text input used across the auth screens. `aria-label` falls back to the
// placeholder because these fields have no visible <label>.
export function AuthField({ icon: Icon, invalid, className, ...props }: Props) {
  return (
    <div
      className={`flex items-center gap-3 rounded-full bg-input px-5 ${
        invalid ? "ring-2 ring-destructive" : "focus-within:ring-2 focus-within:ring-primary"
      }`}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      <input
        aria-label={props["aria-label"] ?? props.placeholder}
        aria-invalid={invalid || undefined}
        {...props}
        className={`min-w-0 flex-1 bg-transparent py-4 text-sm outline-none ${className ?? ""}`}
      />
    </div>
  );
}
