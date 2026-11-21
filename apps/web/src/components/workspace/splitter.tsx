"use client";

import { useRef } from "react";

/** Vertical splitter: drag with a pointer, or focus it and use Left/Right/Home/End. */
export function Splitter({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const dragging = useRef(false);
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v)));
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      className="group relative hidden w-2 cursor-col-resize touch-none md:block"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const left = e.currentTarget.parentElement?.getBoundingClientRect().left ?? 0;
        onChange(clamp(e.clientX - left));
      }}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 48 : 16;
        if (e.key === "ArrowLeft") onChange(clamp(value - step));
        else if (e.key === "ArrowRight") onChange(clamp(value + step));
        else if (e.key === "Home") onChange(min);
        else if (e.key === "End") onChange(max);
        else return;
        e.preventDefault();
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line group-hover:w-0.5 group-hover:bg-primary group-focus-visible:w-0.5 group-focus-visible:bg-primary-strong"
      />
    </div>
  );
}
