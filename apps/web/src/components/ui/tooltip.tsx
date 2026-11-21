"use client";

import { cloneElement, useId, useState } from "react";

/** Tooltip shown on hover and keyboard focus. The label is also the trigger's description, never its only name. */
export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement<{ "aria-describedby"?: string }>;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      {open ? cloneElement(children, { "aria-describedby": id }) : children}
      {open && (
        <span
          id={id}
          role="tooltip"
          className="am-fade pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[12px] text-white"
        >
          {label}
        </span>
      )}
    </span>
  );
}
