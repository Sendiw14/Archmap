/** Small, pure formatting helpers shared by pages. Numbers shown to users always come from data. */

const MIB = 1024 * 1024;

export function formatMiB(bytes: number): string {
  return `${Number((bytes / MIB).toFixed(1))} MiB`;
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 120) return `${s} seconds`;
  const m = Math.round(s / 60);
  return `${m} minutes`;
}

export function formatHours(h: number): string {
  return h === 1 ? "1 hour" : `${h} hours`;
}

export const shortSha = (sha: string | null | undefined): string => (sha ? sha.slice(0, 7) : "");

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "not recorded";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "not recorded";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** "in 23 h 10 min", "5 min ago". `now` is injectable for tests. */
export function relativeTime(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  if (Number.isNaN(diff)) return "";
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60_000);
  let text: string;
  if (min < 1) text = "less than a minute";
  else if (min < 60) text = `${min} min`;
  else {
    const h = Math.floor(min / 60);
    const m = min % 60;
    text = m ? `${h} h ${m} min` : `${h} h`;
  }
  if (min < 1) return diff >= 0 ? "in less than a minute" : "just now";
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
