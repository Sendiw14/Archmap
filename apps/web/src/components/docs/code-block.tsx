"use client";

import { CopyButton } from "../ui/copy-button";

/** A code sample with a header bar (label and copy button). `copy` defaults to the displayed text. */
export function CodeBlock({
  children,
  label,
  copy,
}: {
  children: string;
  label?: string;
  copy?: string;
}) {
  const text = children.replace(/\n$/, "");
  return (
    <div className="not-prose overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-bg px-3 py-1">
        <span className="text-[12px] font-medium text-muted">{label ?? "Code"}</span>
        <CopyButton
          text={copy ?? text}
          label="Copy"
          announce={`${label ?? "Code"} copied to clipboard`}
          className="am-btn am-btn-quiet am-btn-sm"
        />
      </div>
      <pre className="am-pre !rounded-none !border-0" tabIndex={0} aria-label={label}>
        <code>{text}</code>
      </pre>
    </div>
  );
}
