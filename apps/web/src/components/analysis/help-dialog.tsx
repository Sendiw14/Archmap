"use client";

import { Dialog } from "../ui/dialog";
import { Kbd } from "../ui/primitives";

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      title="Using the workspace"
      onClose={onClose}
      footer={
        <button type="button" className="am-btn am-btn-primary" onClick={onClose} data-autofocus>
          Done
        </button>
      }
    >
      <h3 className="font-display text-[14px] font-semibold">Reading the graph</h3>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        <li>
          Each box is a module. An arrow points from the module that imports to the module it
          imports.
        </li>
        <li>
          Solid lines are runtime imports. Dashed lines are type-only imports, erased at runtime.
        </li>
        <li>
          Select a module to light up what it imports and what imports it. The inspector shows the
          source line behind every edge.
        </li>
        <li>
          Large graphs start grouped by folder. Click or press Enter on a group to expand it; use
          the module&apos;s inspector to collapse it again.
        </li>
        <li>
          &quot;Potential change impact&quot; is static reachability, not a prediction that anything
          will break.
        </li>
      </ul>
      <h3 className="mt-4 font-display text-[14px] font-semibold">Keyboard</h3>
      <dl className="mt-1.5 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5">
        <dt>
          <Kbd>/</Kbd>
        </dt>
        <dd>Focus the search box</dd>
        <dt>
          <Kbd>Esc</Kbd>
        </dt>
        <dd>Clear the search, then the selection; leaves full screen</dd>
        <dt>
          <Kbd>F</Kbd>
        </dt>
        <dd>Fit the whole graph in view</dd>
        <dt>
          <Kbd>?</Kbd>
        </dt>
        <dd>Open this help</dd>
        <dt>
          <Kbd>Tab</Kbd>
        </dt>
        <dd>Move between panels, nodes and controls; Enter or Space selects</dd>
        <dt>
          <Kbd>↑ ↓ ← →</Kbd>
        </dt>
        <dd>Move and expand or collapse in the explorer tree</dd>
      </dl>
      <p className="mt-4 text-muted">
        The graph is never the only view: switch to List for a table of the same modules, fully
        operable by keyboard and screen reader.
      </p>
    </Dialog>
  );
}
