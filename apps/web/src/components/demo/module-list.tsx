"use client";

import { useRef } from "react";
import { Box, Cpu, FileCode2 } from "lucide-react";
import type { ModuleRow } from "../../lib/graph/model";
import type { SearchHit } from "../../lib/graph/search";
import { HighlightedText } from "./highlighted-text";

const ICON = { file: FileCode2, external: Box, builtin: Cpu } as const;

/**
 * Accessible alternative to the graph (spec 12.3): every module and its relationships,
 * operable with Tab / Arrow keys / Enter and without hover.
 */
export function ModuleList({
  rows,
  hits,
  selectedId,
  onSelect,
  caption,
}: {
  rows: ModuleRow[];
  hits: Map<string, SearchHit> | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  caption: string;
}) {
  const body = useRef<HTMLTableSectionElement>(null);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const buttons = [
      ...(body.current?.querySelectorAll<HTMLButtonElement>("button[data-row]") ?? []),
    ];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next =
      e.key === "ArrowDown"
        ? i + 1
        : e.key === "ArrowUp"
          ? i - 1
          : e.key === "Home"
            ? 0
            : buttons.length - 1;
    buttons[Math.max(0, Math.min(buttons.length - 1, next))]?.focus();
  };

  if (rows.length === 0) {
    return (
      <p className="p-6 text-sm text-muted" role="status">
        No modules to show with the current search and filters.
      </p>
    );
  }

  return (
    <table className="w-full border-collapse text-left text-[13px]">
      <caption className="sr-only">{caption}</caption>
      <thead className="sticky top-0 z-10 bg-surface text-[12px] uppercase tracking-wide text-muted">
        <tr>
          <th scope="col" className="px-3 py-2 font-semibold">
            Module
          </th>
          <th scope="col" className="hidden px-3 py-2 font-semibold md:table-cell">
            Imported modules
          </th>
          <th scope="col" className="w-[4.5rem] px-2 py-2 text-right font-semibold">
            Imports
          </th>
          <th scope="col" className="w-[4.5rem] px-2 py-2 text-right font-semibold">
            Imported by
          </th>
        </tr>
      </thead>
      <tbody ref={body} onKeyDown={onKeyDown}>
        {rows.map((r) => {
          const Icon = ICON[r.kind];
          const selected = r.id === selectedId;
          return (
            <tr key={r.id} className={`border-t border-line ${selected ? "bg-primary-soft" : ""}`}>
              <th scope="row" className="p-0 align-top font-normal">
                <button
                  type="button"
                  data-row
                  aria-current={selected ? "true" : undefined}
                  className="flex min-h-12 w-full items-start gap-2 px-3 py-2 text-left hover:bg-elevated"
                  onClick={() => onSelect(r.id)}
                >
                  <Icon size={16} aria-hidden="true" className="mt-0.5 flex-none text-muted" />
                  <span className="min-w-0">
                    <span className="block break-all font-mono text-[12.5px] font-semibold leading-snug">
                      <HighlightedText text={r.path} ranges={hits?.get(r.id)?.ranges} />
                    </span>
                    <span className="block text-[12px] text-muted">
                      {r.kind === "file"
                        ? [r.package, r.language].filter(Boolean).join(" · ") || "file"
                        : r.kind === "external"
                          ? "external package"
                          : "Node.js built-in"}
                    </span>
                  </span>
                </button>
              </th>
              <td className="hidden max-w-[28ch] px-3 py-2 align-top text-muted md:table-cell">
                {r.imports.length === 0 ? (
                  <span aria-label="no imports">none</span>
                ) : (
                  <span className="line-clamp-2 break-words font-mono text-[12px]">
                    {r.imports.join(", ")}
                  </span>
                )}
              </td>
              <td className="px-2 py-2 text-right align-top tabular-nums">{r.importCount}</td>
              <td className="px-2 py-2 text-right align-top tabular-nums">{r.importedByCount}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
