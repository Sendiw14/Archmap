"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

export type TourAction = "select-example" | "open-circular" | "show-list";

interface Step {
  title: string;
  body: React.ReactNode;
  action?: { label: string; run: TourAction };
}

const STEPS: Step[] = [
  {
    title: "This is real analyzer output",
    body: "Every graph here was produced by running the ARCHMAP CLI, then committed as JSON. The banner above says which repository and which command. Nothing is mocked.",
  },
  {
    title: "Select a module",
    body: "Click a node, or Tab to it and press Enter. Its imports and importers light up, and the inspector shows the exact source line behind each edge plus its potential change impact.",
    action: { label: "Select an example for me", run: "select-example" },
  },
  {
    title: "Investigate a cycle",
    body: "Circular imports are listed under Cycles. Choose one to highlight its members and the edges that close the loop. The circular sample has a runtime cycle.",
    action: { label: "Open the circular sample", run: "open-circular" },
  },
  {
    title: "Use the list, or bring your own repo",
    body: (
      <>
        The List view is a table of the same modules and relationships, fully keyboard operable. To
        analyze your own repository, run the CLI locally; see{" "}
        <Link
          href="/docs/cli"
          className="font-medium text-primary-strong underline underline-offset-2"
        >
          the CLI instructions
        </Link>
        .
      </>
    ),
    action: { label: "Switch to list view", run: "show-list" },
  },
];

export function Tour({
  step,
  onStep,
  onClose,
  onAction,
  focusOnMount,
}: {
  step: number;
  onStep: (n: number) => void;
  onClose: () => void;
  onAction: (a: TourAction) => void;
  focusOnMount: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) heading.current?.focus();
  }, [focusOnMount]);
  const s = STEPS[step]!;
  const last = step === STEPS.length - 1;
  return (
    <section
      aria-label="Guided walkthrough"
      className="am-enter border-b border-line bg-primary-soft px-4 py-3 sm:px-6"
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-3xl">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">
            Walkthrough, step {step + 1} of {STEPS.length}
          </p>
          <h2
            ref={heading}
            tabIndex={-1}
            className="font-display text-[15px] font-semibold outline-none"
          >
            {s.title}
          </h2>
          <p className="mt-1 text-[14px] leading-snug">{s.body}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {s.action && (
            <button
              type="button"
              className="am-btn am-btn-sm"
              onClick={() => onAction(s.action!.run)}
            >
              {s.action.label}
            </button>
          )}
          <button
            type="button"
            className="am-btn am-btn-sm"
            onClick={() => onStep(step - 1)}
            disabled={step === 0}
          >
            <ArrowLeft size={14} aria-hidden="true" /> Back
          </button>
          <button
            type="button"
            className="am-btn am-btn-sm am-btn-primary"
            onClick={() => (last ? onClose() : onStep(step + 1))}
          >
            {last ? "Done" : "Next"} {!last && <ArrowRight size={14} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="am-btn am-btn-sm am-btn-quiet"
            onClick={onClose}
            aria-label="Dismiss walkthrough"
          >
            <X size={16} aria-hidden="true" /> Dismiss
          </button>
        </div>
      </div>
    </section>
  );
}
