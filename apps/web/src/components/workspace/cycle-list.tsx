import { RefreshCcw } from "lucide-react";
import type { CycleItem } from "../../lib/graph/model";

export function CycleList({
  items,
  activeId,
  onSelect,
}: {
  items: CycleItem[];
  activeId: string | null;
  onSelect: (item: CycleItem) => void;
}) {
  return (
    <section aria-labelledby="cycles-h">
      <h3 id="cycles-h" className="am-eyebrow">
        Cycles ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">No runtime or type-only cycles were found.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="am-btn h-auto w-full flex-col items-start gap-1 py-2 text-left"
                aria-pressed={activeId === c.id}
                onClick={() => onSelect(c)}
              >
                <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <RefreshCcw size={14} aria-hidden="true" />
                  {c.title}
                </span>
                <span className="break-words font-mono text-[12px] font-normal text-muted">
                  {c.members.map((m) => m.displayName).join(" → ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
