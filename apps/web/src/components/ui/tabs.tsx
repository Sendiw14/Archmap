"use client";

import { useRef } from "react";

export interface TabDef {
  id: string;
  label: React.ReactNode;
}

/**
 * Accessible tabs (WAI-ARIA tabs pattern): roving tabindex, Left/Right/Home/End, automatic
 * activation. The caller renders the panel with `role="tabpanel"` using `tabPanelProps`.
 */
export function Tabs({
  tabs,
  active,
  onChange,
  label,
  idPrefix,
  className = "",
}: {
  idPrefix: string;
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  label: string;
  className?: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active);
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = tabs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    onChange(tabs[n]!.id);
    list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[n]?.focus();
  };
  return (
    <div
      ref={list}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`flex gap-1 ${className}`}
    >
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            id={`${idPrefix}-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={on}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`min-h-9 flex-1 rounded-lg px-2.5 text-[13px] font-medium ${
              on
                ? "bg-primary-soft text-ink shadow-[inset_0_0_0_1px_var(--color-primary-strong)]"
                : "text-muted hover:bg-elevated hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Props for the panel that belongs to the active tab. */
export const tabPanelProps = (idPrefix: string, active: string) => ({
  role: "tabpanel" as const,
  id: `${idPrefix}-panel`,
  "aria-labelledby": `${idPrefix}-tab-${active}`,
});
