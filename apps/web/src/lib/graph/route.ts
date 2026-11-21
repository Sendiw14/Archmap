import type { Point } from "./layout-input";

/** SVG path through `points` with rounded corners (radius capped at half of each segment). */
export function roundedPath(points: Point[], radius = 8): string {
  const first = points[0];
  if (!first) return "";
  let d = `M${first.x} ${first.y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    const next = points[i + 1]!;
    const a = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const b = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(radius, a / 2, b / 2);
    if (r <= 0) {
      d += ` L${cur.x} ${cur.y}`;
      continue;
    }
    const inX = cur.x - ((cur.x - prev.x) / a) * r;
    const inY = cur.y - ((cur.y - prev.y) / a) * r;
    const outX = cur.x + ((next.x - cur.x) / b) * r;
    const outY = cur.y + ((next.y - cur.y) / b) * r;
    d += ` L${inX} ${inY} Q${cur.x} ${cur.y} ${outX} ${outY}`;
  }
  const last = points[points.length - 1]!;
  if (points.length > 1) d += ` L${last.x} ${last.y}`;
  return d;
}
