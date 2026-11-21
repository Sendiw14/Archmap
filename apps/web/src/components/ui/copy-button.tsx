"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useToast } from "./toast";

/** Copies `text`; the button says "Copied" and a toast announces it. Falls back gracefully without clipboard access. */
export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  announce,
  className = "am-btn am-btn-sm",
  iconOnly = false,
  ariaLabel,
}: {
  text: string | (() => string);
  label?: string;
  copiedLabel?: string;
  announce?: string;
  className?: string;
  iconOnly?: boolean;
  ariaLabel?: string;
}) {
  const [done, setDone] = useState(false);
  const notify = useToast();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className={className}
      aria-label={iconOnly ? (ariaLabel ?? label) : ariaLabel}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(typeof text === "function" ? text() : text);
          setDone(true);
          notify(announce ?? `${label.replace(/^Copy /, "")} copied to clipboard`);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setDone(false), 1500);
        } catch {
          notify("Copying is not available in this browser", "error");
        }
      }}
    >
      {done ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {!iconOnly && (done ? copiedLabel : label)}
    </button>
  );
}
