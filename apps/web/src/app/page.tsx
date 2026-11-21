import Link from "next/link";
import { ArrowRight, Terminal } from "lucide-react";

/** Decorative motif only: a few modules and the import edges between them. */
function HeroMotif() {
  const nodes = [
    { x: 24, y: 40, w: 112 },
    { x: 24, y: 128, w: 96 },
    { x: 176, y: 12, w: 120 },
    { x: 176, y: 96, w: 104 },
    { x: 176, y: 180, w: 120 },
    { x: 336, y: 56, w: 96 },
    { x: 336, y: 148, w: 112 },
  ];
  const edges: [number, number, boolean?][] = [
    [0, 2],
    [0, 3],
    [1, 3],
    [1, 4, true],
    [2, 5],
    [3, 5],
    [3, 6, true],
    [4, 6],
  ];
  return (
    <svg viewBox="0 0 480 240" className="h-auto w-full" aria-hidden="true" role="presentation">
      {edges.map(([a, b, dashed], i) => {
        const s = nodes[a]!;
        const t = nodes[b]!;
        const x1 = s.x + s.w;
        const y1 = s.y + 16;
        const x2 = t.x;
        const y2 = t.y + 16;
        const mx = (x1 + x2) / 2;
        return (
          <path
            key={i}
            d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`}
            fill="none"
            stroke={i === 2 || i === 5 ? "#476cf0" : "#7a88a1"}
            strokeWidth={i === 2 || i === 5 ? 2 : 1.5}
            strokeDasharray={dashed ? "6 4" : undefined}
          />
        );
      })}
      {nodes.map((n, i) => (
        <g key={i}>
          <rect
            x={n.x}
            y={n.y}
            width={n.w}
            height={32}
            rx={7}
            fill={i === 5 ? "#ece9fd" : "#ffffff"}
            stroke="#6b7a92"
          />
          <rect
            x={n.x}
            y={n.y}
            width={4}
            height={32}
            rx={2}
            fill={i === 5 ? "#5a50d9" : "#476cf0"}
          />
          <rect x={n.x + 14} y={n.y + 11} width={n.w - 36} height={4} rx={2} fill="#c3ccdb" />
          <rect
            x={n.x + 14}
            y={n.y + 19}
            width={(n.w - 36) * 0.6}
            height={3}
            rx={1.5}
            fill="#e2e8f0"
          />
        </g>
      ))}
    </svg>
  );
}

export default function Landing() {
  return (
    <section className="mx-auto grid min-h-[calc(100dvh-3.5rem)] max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
      <div>
        <p className="am-eyebrow am-enter">Dependency graphs, with evidence</p>
        <h1 className="am-enter-2 mt-4 font-display text-[clamp(2.25rem,5.5vw,3.75rem)] font-semibold leading-[1.08] tracking-tight text-ink">
          See the architecture behind your code.
        </h1>
        <p className="am-enter-3 mt-5 max-w-[34rem] text-[17px] leading-relaxed text-muted">
          ARCHMAP analyzes JavaScript and TypeScript repositories and draws how modules depend on
          each other. Every edge points back to the import statement that created it.
        </p>
        <div className="am-enter-3 mt-8 flex flex-wrap items-center gap-3">
          <Link href="/demo" className="am-btn am-btn-primary min-h-12 px-5 text-[15px]">
            Explore the live demo
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link href="/docs/cli" className="am-btn min-h-12 px-5 text-[15px]">
            <Terminal size={18} aria-hidden="true" />
            Analyze your own repo
          </Link>
        </div>
        <p className="mt-6 text-sm text-muted">
          The demo runs on real analyzer output. No account required.
        </p>
      </div>
      <div className="am-fade rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <HeroMotif />
      </div>
    </section>
  );
}
