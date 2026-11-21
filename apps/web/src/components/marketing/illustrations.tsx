/** Original SVG illustrations. Decorative: always aria-hidden. They draw the same motifs as the product (boxes, import arrows). */

const Frame = ({
  children,
  w = 112,
  h = 72,
}: {
  children: React.ReactNode;
  w?: number;
  h?: number;
}) => (
  <svg
    viewBox={`0 0 ${w} ${h}`}
    width={w}
    height={h}
    aria-hidden="true"
    focusable="false"
    className="h-auto w-full max-w-[9rem]"
  >
    {children}
  </svg>
);
const box = (
  x: number,
  y: number,
  w = 30,
  stroke = "var(--color-control)",
  fill = "var(--color-bg)",
) => <rect x={x} y={y} width={w} height={16} rx={4} fill={fill} stroke={stroke} />;
const bar = (x: number, y: number, w: number) => (
  <rect x={x} y={y} width={w} height={3} rx={1.5} fill="var(--color-line)" />
);

export const ScanArt = () => (
  <Frame>
    <rect
      x={10}
      y={8}
      width={52}
      height={56}
      rx={6}
      fill="var(--color-bg)"
      stroke="var(--color-control)"
    />
    {bar(18, 18, 28)}
    {bar(18, 26, 36)}
    {bar(18, 34, 22)}
    {bar(18, 42, 32)}
    <path
      d="M70 20h28M70 36h20M70 52h26"
      stroke="var(--color-primary)"
      strokeWidth={2}
      strokeLinecap="round"
    />
    <circle cx={102} cy={20} r={3} fill="var(--color-primary)" />
    <circle cx={94} cy={36} r={3} fill="var(--color-primary)" />
    <circle cx={100} cy={52} r={3} fill="var(--color-primary)" />
  </Frame>
);
export const ExtractArt = () => (
  <Frame>
    <rect
      x={8}
      y={10}
      width={58}
      height={52}
      rx={6}
      fill="var(--color-surface)"
      stroke="var(--color-control)"
    />
    <rect
      x={14}
      y={22}
      width={46}
      height={10}
      rx={3}
      fill="var(--color-primary-soft)"
      stroke="var(--color-primary-strong)"
    />
    {bar(14, 16, 18)}
    {bar(14, 40, 30)}
    {bar(14, 48, 24)}
    <path d="M66 27h14" stroke="var(--color-primary-strong)" strokeWidth={2} />
    <path d="M78 22l7 5-7 5z" fill="var(--color-primary-strong)" />
    <rect
      x={88}
      y={14}
      width={18}
      height={26}
      rx={4}
      fill="var(--color-bg)"
      stroke="var(--color-control)"
    />
    {bar(92, 20, 10)}
    {bar(92, 27, 8)}
  </Frame>
);
export const ResolveArt = () => (
  <Frame>
    {box(6, 28, 30)}
    <path d="M36 36c14 0 10-18 26-18" fill="none" stroke="var(--color-primary)" strokeWidth={2} />
    <path
      d="M36 36c14 0 10 18 26 18"
      fill="none"
      stroke="var(--color-edge)"
      strokeWidth={1.5}
      strokeDasharray="5 4"
    />
    {box(62, 10, 30, "var(--color-primary-strong)")}
    {box(62, 46, 30, "var(--color-control)", "var(--color-accent-soft)")}
    <path
      d="M98 54l8 8M106 54l-8 8"
      stroke="var(--color-danger)"
      strokeWidth={2}
      strokeLinecap="round"
      opacity={0}
    />
  </Frame>
);
export const GraphArt = () => (
  <Frame>
    {box(4, 8, 28)}
    {box(4, 48, 28)}
    {box(42, 28, 28, "var(--color-primary-strong)")}
    {box(80, 8, 28, "var(--color-control)", "var(--color-accent-soft)")}
    {box(80, 48, 28)}
    <path
      d="M32 16C38 16 36 36 42 36M32 56C38 56 36 36 42 36M70 36C76 36 74 16 80 16M70 36C76 36 74 56 80 56"
      fill="none"
      stroke="var(--color-edge)"
      strokeWidth={1.5}
    />
  </Frame>
);

export const EvidenceArt = () => (
  <Frame>
    <rect
      x={8}
      y={10}
      width={64}
      height={22}
      rx={5}
      fill="var(--color-surface)"
      stroke="var(--color-control)"
    />
    {bar(14, 17, 40)}
    {bar(14, 24, 28)}
    <path d="M72 21h12" stroke="var(--color-primary)" strokeWidth={2} />
    <rect
      x={84}
      y={10}
      width={22}
      height={22}
      rx={5}
      fill="var(--color-primary-soft)"
      stroke="var(--color-primary-strong)"
    />
    <rect
      x={8}
      y={42}
      width={22}
      height={22}
      rx={5}
      fill="var(--color-bg)"
      stroke="var(--color-control)"
    />
    <path d="M30 53h12" stroke="var(--color-primary)" strokeWidth={2} />
    <rect
      x={42}
      y={42}
      width={64}
      height={22}
      rx={5}
      fill="var(--color-surface)"
      stroke="var(--color-control)"
    />
    {bar(48, 49, 36)}
    {bar(48, 56, 46)}
  </Frame>
);
export const CycleArt = () => (
  <Frame>
    {box(6, 28, 28, "var(--color-cycle)")}
    {box(44, 6, 28, "var(--color-cycle)")}
    {box(78, 40, 28, "var(--color-cycle)")}
    <path
      d="M34 32 44 18M72 14l16 26M78 52H44c-6 0-10-2-10-8"
      fill="none"
      stroke="var(--color-cycle)"
      strokeWidth={2}
    />
  </Frame>
);
export const ImpactArt = () => (
  <Frame>
    {box(80, 28, 26, "var(--color-primary-strong)")}
    {box(42, 8, 26, "var(--color-accent-strong)")}
    {box(42, 48, 26, "var(--color-accent-strong)")}
    {box(4, 8, 26)}
    {box(4, 28, 26)}
    {box(4, 48, 26)}
    <path
      d="M68 16C76 16 74 36 80 36M68 56C76 56 74 36 80 36M30 16h12M30 36C36 36 36 56 42 56M30 56h12"
      fill="none"
      stroke="var(--color-accent-strong)"
      strokeWidth={1.8}
    />
  </Frame>
);
export const GroupArt = () => (
  <Frame>
    <rect
      x={6}
      y={8}
      width={44}
      height={56}
      rx={8}
      fill="var(--color-surface)"
      stroke="var(--color-control)"
      strokeDasharray="5 3"
    />
    {box(12, 16, 32)}
    {box(12, 38, 32)}
    <rect
      x={66}
      y={20}
      width={38}
      height={26}
      rx={6}
      fill="var(--color-bg)"
      stroke="var(--color-ink)"
      strokeDasharray="5 3"
    />
    <rect
      x={70}
      y={24}
      width={38}
      height={26}
      rx={6}
      fill="none"
      stroke="var(--color-control)"
      opacity={0.55}
    />
    <path d="M50 36h14" stroke="var(--color-edge)" strokeWidth={1.5} />
  </Frame>
);
export const ListArt = () => (
  <Frame>
    <rect
      x={8}
      y={8}
      width={96}
      height={56}
      rx={6}
      fill="var(--color-bg)"
      stroke="var(--color-control)"
    />
    <path d="M8 22h96M8 36h96M8 50h96" stroke="var(--color-line)" />
    {bar(14, 13, 34)}
    {bar(14, 27, 40)}
    <rect x={8} y={36} width={96} height={14} fill="var(--color-primary-soft)" />
    {bar(14, 41, 30)}
    {bar(14, 55, 44)}
  </Frame>
);
export const ExportArt = () => (
  <Frame>
    <rect
      x={10}
      y={6}
      width={40}
      height={52}
      rx={5}
      fill="var(--color-bg)"
      stroke="var(--color-control)"
    />
    {bar(16, 16, 22)}
    {bar(16, 24, 28)}
    {bar(16, 32, 18)}
    <path
      d="M62 38h30M84 30l10 8-10 8"
      fill="none"
      stroke="var(--color-primary-strong)"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x={64}
      y={48}
      width={40}
      height={12}
      rx={4}
      fill="var(--color-primary-soft)"
      stroke="var(--color-primary-strong)"
    />
  </Frame>
);
export const LockArt = () => (
  <Frame>
    <rect
      x={36}
      y={32}
      width={40}
      height={30}
      rx={6}
      fill="var(--color-bg)"
      stroke="var(--color-ink)"
      strokeWidth={1.5}
    />
    <path
      d="M44 32v-8a12 12 0 0 1 24 0v8"
      fill="none"
      stroke="var(--color-ink)"
      strokeWidth={1.5}
    />
    <circle cx={56} cy={46} r={4} fill="var(--color-primary)" />
  </Frame>
);
