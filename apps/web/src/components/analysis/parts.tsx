import Link from "next/link";
import { Badge } from "../ui/primitives";
import type { Diagnostic, GraphEdge, GraphNode, Severity } from "@archmap/graph-schema";

export const SEVERITY_TONE: Record<Severity, "danger" | "warning" | "info"> = {
  error: "danger",
  warning: "warning",
  info: "info",
};

export function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-h`}
      id={id}
      className="scroll-mt-24 border-t border-line py-9 first:border-t-0 first:pt-0"
    >
      <h3 id={`${id}-h`} className="font-display text-xl font-semibold tracking-tight">
        {title}
      </h3>
      {lead && <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-muted">{lead}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="am-card p-4">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-1">
        <span className="font-display text-2xl font-semibold tabular-nums tracking-tight">
          {value}
        </span>
        {hint && <span className="mt-1 block text-[12px] leading-snug text-muted">{hint}</span>}
      </dd>
    </div>
  );
}

export function NodeLink({
  base,
  node,
  children,
}: {
  base: string;
  node: Pick<GraphNode, "id" | "path">;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={`${base}?node=${encodeURIComponent(node.id)}`}
      className="break-all font-mono text-[12.5px] font-semibold text-primary-strong underline underline-offset-2"
    >
      {children ?? node.path}
    </Link>
  );
}

export function EvidenceTable({
  edges,
  caption,
  nodeById,
}: {
  edges: GraphEdge[];
  caption: string;
  nodeById?: Map<string, GraphNode>;
}) {
  if (edges.length === 0) return null;
  return (
    <div className="am-table-wrap">
      <table className="am-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Location</th>
            <th scope="col">Statement</th>
            <th scope="col">Kind</th>
            {nodeById && <th scope="col">Resolves to</th>}
          </tr>
        </thead>
        <tbody>
          {edges.map((e) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap font-mono text-[12.5px]">
                {e.evidence.file}:{e.evidence.line}:{e.evidence.column}
              </td>
              <td className="break-words font-mono text-[12.5px] text-muted">
                <code>{e.evidence.text}</code>
              </td>
              <td className="whitespace-nowrap text-[13px]">
                {e.importKind}{" "}
                <Badge className={e.dependencyClass === "type-only" ? "border-dashed" : ""}>
                  {e.dependencyClass}
                </Badge>
              </td>
              {nodeById && (
                <td className="break-all font-mono text-[12.5px]">
                  {e.target ? (
                    (nodeById.get(e.target)?.path ?? e.target)
                  ) : (
                    <span className="text-danger">unresolved</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DiagnosticsTable({ items }: { items: Diagnostic[] }) {
  return (
    <div className="am-table-wrap">
      <table className="am-table">
        <caption className="sr-only">Analyzer diagnostics</caption>
        <thead>
          <tr>
            <th scope="col">Severity</th>
            <th scope="col">Code</th>
            <th scope="col">Message</th>
            <th scope="col">Where</th>
          </tr>
        </thead>
        <tbody>
          {items.map((d, i) => (
            <tr key={`${d.code}-${i}`}>
              <td>
                <Badge tone={SEVERITY_TONE[d.severity]}>{d.severity}</Badge>
              </td>
              <td className="font-mono text-[12.5px]">{d.code}</td>
              <td className="break-words">{d.message}</td>
              <td className="break-all font-mono text-[12.5px]">
                {d.location
                  ? `${d.location.file}:${d.location.line}:${d.location.column}`
                  : (d.file ?? "")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-control bg-surface px-4 py-3 text-[14px] text-muted">
      {children}
    </p>
  );
}

export function PageFrame({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`mx-auto w-full px-4 pb-24 pt-8 sm:px-6 ${wide ? "max-w-[1600px]" : "max-w-6xl"}`}
    >
      {children}
    </div>
  );
}

export function Toc({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav
      aria-label="On this page"
      className="am-no-print flex flex-wrap gap-x-4 gap-y-1 text-[14px]"
    >
      {items.map((i) => (
        <a
          key={i.id}
          href={`#${i.id}`}
          className="inline-flex min-h-8 items-center text-primary-strong underline underline-offset-2"
        >
          {i.label}
        </a>
      ))}
    </nav>
  );
}
