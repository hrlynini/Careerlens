// Score history + follow-up helpers (all stored in the browser).

/** Stable short key for a job description, so re-analyzing the same job can be matched up. */
export function jdKey(text) {
  const s = text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 4000);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `jd${(h >>> 0).toString(36)}`;
}

export const today = () => new Date().toISOString().slice(0, 10);

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
}

export const FOLLOW_UP_DAYS = 7;

export function prettyDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
