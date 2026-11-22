import { TEAM_RANGES, type TeamRange } from "@/lib/queries/team";

export function PeriodFilter({
  value,
  onChange,
}: {
  value: TeamRange;
  onChange: (range: TeamRange) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Period"
      className="inline-flex gap-1 rounded-full bg-surface-2 p-1"
    >
      {TEAM_RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          aria-pressed={value === r.id}
          onClick={() => onChange(r.id)}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
            value === r.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
