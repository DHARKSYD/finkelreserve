import type { ReactNode } from "react";

export function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg mb-2 ${
          accent ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"
        }`}
      >
        {icon}
      </div>
      <p className="font-display font-black text-2xl">{value}</p>
      <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground mt-0.5">
        {label}
      </p>
    </div>
  );
}
