"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { useFocusTrap } from "./use-focus-trap";

/** Modal dialog: focus moves in and is trapped, Escape or the backdrop closes, focus returns to the opener. */
export function Dialog({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="am-fade absolute inset-0 bg-ink/40" aria-hidden="true" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="am-pop relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-2xl border border-line bg-bg shadow-[0_24px_64px_rgba(21,27,43,0.25)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3">
          <h2 id={titleId} className="font-display text-base font-semibold">
            {title}
          </h2>
          <button
            type="button"
            className="am-btn am-btn-quiet -mr-2 size-10 !px-0"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div tabIndex={0} className="overflow-y-auto px-5 py-4 text-[14px] leading-relaxed">
          {children}
        </div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
