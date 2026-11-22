// Native date helpers. The app avoids date-fns because of the type-declaration gap in this
// install (see the note in admin.analytics.tsx).

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** "5 minutes ago", "yesterday", "3 months ago". Null means it never happened. */
export function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  for (const [unit, size] of STEPS) {
    if (abs >= size) return RELATIVE.format(Math.round(seconds / size), unit);
  }
  return RELATIVE.format(Math.round(seconds / 60), "minute");
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Chart axis label for a calendar day such as "2026-11-16". */
export function dayLabel(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
  });
}

export function dayLabelLong(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function responseTime(hours: number | null): string {
  if (hours == null) return "n/a";
  if (hours < 1) return "Under 1 hour";
  if (hours < 48) return `${hours.toFixed(1)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
}

export const CATEGORY_LABEL: Record<string, string> = {
  orders: "Orders",
  returns: "Returns",
  payments: "Payments",
  products: "Products",
  inventory: "Inventory",
  promotions: "Promotions",
  reviews: "Reviews",
  team: "Team",
  sensitive: "Flagged",
};

const DAY_MS = 86_400_000;

/**
 * A short warning for an active admin who has gone quiet, or null when there is nothing to flag.
 * Dormant admin accounts are worth noticing: they are access nobody is watching.
 */
export function idleNote(
  m: { status: string; isSuperAdmin: boolean; addedAt: string; lastActionAt: string | null },
  now: number = Date.now(),
): string | null {
  if (m.status !== "active" || m.isSuperAdmin) return null;
  if (m.lastActionAt) {
    return now - new Date(m.lastActionAt).getTime() > 30 * DAY_MS ? "Idle 30+ days" : null;
  }
  return now - new Date(m.addedAt).getTime() > 14 * DAY_MS ? "No activity yet" : null;
}
