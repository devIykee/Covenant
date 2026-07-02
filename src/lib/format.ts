// Shared date/time display helpers so the deadline shows consistently (date AND
// time) across cards, detail, dashboard, and the timeline.

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// Prefer the real deadline timestamp; fall back to the block height for old rows.
export function formatDeadline(deadlineAt?: string | null, deadlineBlock?: number): string {
  const dt = formatDateTime(deadlineAt);
  if (dt) return dt;
  return deadlineBlock ? `Block ${deadlineBlock}` : "—";
}

// "in 2 days", "in 5 hours", "3 hours ago" — relative to now.
export function relativeTime(value?: string | Date | null): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  const diffMs = d.getTime() - Date.now();
  const past = diffMs < 0;
  const mins = Math.round(Math.abs(diffMs) / 60000);
  const hours = Math.round(mins / 60);
  const days = Math.round(hours / 24);
  let label: string;
  if (mins < 60) label = `${mins} min`;
  else if (hours < 48) label = `${hours} hr`;
  else label = `${days} days`;
  return past ? `${label} ago` : `in ${label}`;
}
