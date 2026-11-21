import { Box, Cpu, FileCode2, Link2Off } from "lucide-react";

function EdgeSample({ dashed }: { dashed?: boolean }) {
  return (
    <svg width="40" height="12" viewBox="0 0 40 12" aria-hidden="true" className="flex-none">
      <line
        x1="1"
        y1="6"
        x2="30"
        y2="6"
        stroke="var(--color-edge)"
        strokeWidth="2"
        strokeDasharray={dashed ? "6 4" : undefined}
      />
      <path d="M29 1.5 38 6 29 10.5Z" fill="var(--color-edge)" />
    </svg>
  );
}

export function Legend({ unresolvedCount }: { unresolvedCount: number }) {
  return (
    <section aria-labelledby="legend-h">
      <h3 id="legend-h" className="am-eyebrow">
        Legend
      </h3>
      <dl className="mt-2 space-y-2 text-[13px]">
        <div className="flex items-center gap-2">
          <dt className="flex w-24 flex-none items-center gap-1.5 font-medium">
            <FileCode2 size={16} aria-hidden="true" className="text-primary-strong" /> File
          </dt>
          <dd className="text-muted">Source file in the repository</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="flex w-24 flex-none items-center gap-1.5 font-medium">
            <Box size={16} aria-hidden="true" className="text-accent-strong" /> External
          </dt>
          <dd className="text-muted">Package from node_modules</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="flex w-24 flex-none items-center gap-1.5 font-medium">
            <Cpu size={16} aria-hidden="true" className="text-muted" /> Built-in
          </dt>
          <dd className="text-muted">Node.js built-in module</dd>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <dt className="w-24 flex-none">
            <EdgeSample />
          </dt>
          <dd className="text-muted">
            <span className="font-medium text-ink">Runtime</span> import (solid)
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="w-24 flex-none">
            <EdgeSample dashed />
          </dt>
          <dd className="text-muted">
            <span className="font-medium text-ink">Type-only</span> import (dashed)
          </dd>
        </div>
        <div className="flex items-start gap-2">
          <dt className="flex w-24 flex-none items-center gap-1.5 font-medium">
            <Link2Off size={16} aria-hidden="true" className="text-muted" /> Unresolved
          </dt>
          <dd className="text-muted">Not drawn; listed below ({unresolvedCount} in this sample)</dd>
        </div>
      </dl>
      <p className="mt-3 text-[13px] text-muted">
        Arrows point from the importing module to the imported module.
      </p>
    </section>
  );
}
