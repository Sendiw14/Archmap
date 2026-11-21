"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal bottom sheet for the inspector below the desktop breakpoint.
 * Moves focus in, traps Tab, closes on Escape / backdrop, and restores focus on close.
 */
export function Drawer({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null,
    );
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onKeyDown={onKeyDown}>
      <div className="am-fade absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="am-drawer relative flex max-h-[85dvh] w-full flex-col rounded-t-2xl border border-line bg-bg shadow-[0_-8px_32px_rgba(21,27,43,0.18)]"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <span className="font-display text-sm font-semibold">{label}</span>
          <button
            type="button"
            data-autofocus
            className="am-btn am-btn-quiet size-10 !px-0"
            onClick={onClose}
            aria-label="Close inspector"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div tabIndex={0} className="overflow-y-auto overscroll-contain p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
