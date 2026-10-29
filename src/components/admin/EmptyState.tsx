import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="glass rounded-2xl py-16 px-6 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-display font-bold text-lg">{title}</p>
      {description && (
        <p className="mt-1.5 text-sm text-muted-foreground max-w-sm mx-auto">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
