"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { SearchHit } from "../../lib/graph/search";
import { HighlightedText } from "./highlighted-text";

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  hits: SearchHit[];
  /** Graph view: show an inline result list (combobox). List view filters the table instead. */
  showResults: boolean;
  onChoose: (id: string) => void;
}

export function SearchBox({ query, onQueryChange, hits, showResults, onChoose }: Props) {
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);
  const hasQuery = query.trim().length > 0;
  const listId = `${uid}-results`;

  // keep the active option valid and visible as results change
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    document.getElementById(`${uid}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, uid]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && showResults && hits.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % hits.length);
    } else if (e.key === "ArrowUp" && showResults && hits.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      const hit = hits[showResults ? active : 0];
      if (hit) {
        e.preventDefault();
        onChoose(hit.id);
      }
    } else if (e.key === "Escape" && query) {
      e.preventDefault();
      onQueryChange("");
    }
  };

  const comboProps = showResults
    ? {
        role: "combobox" as const,
        "aria-expanded": hasQuery && hits.length > 0,
        "aria-controls": listId,
        "aria-autocomplete": "list" as const,
        "aria-activedescendant": hasQuery && hits.length ? `${uid}-opt-${active}` : undefined,
      }
    : {};

  return (
    <div>
      <label htmlFor={`${uid}-input`} className="am-eyebrow">
        Search modules by path
      </label>
      <div className="relative mt-1.5">
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          ref={inputRef}
          id={`${uid}-input`}
          type="text"
          autoComplete="off"
          spellCheck={false}
          className="am-field pl-9 pr-10"
          placeholder="e.g. graph-core"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          {...comboProps}
        />
        {query && (
          <button
            type="button"
            className="absolute right-1 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-elevated"
            aria-label="Clear search"
            onClick={() => {
              onQueryChange("");
              inputRef.current?.focus();
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="mt-1.5 text-[13px] text-muted" role="status">
        {!hasQuery
          ? "Type to highlight matching modules."
          : hits.length === 0
            ? "No modules match."
            : `${hits.length} ${hits.length === 1 ? "match" : "matches"}${
                showResults ? ". Use arrow keys and Enter to select." : ". Enter selects the first."
              }`}
      </p>
      {showResults && hasQuery && hits.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-line bg-bg"
        >
          {hits.map((h, i) => (
            <li
              key={h.id}
              id={`${uid}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onClick={() => onChoose(h.id)}
              className={`cursor-pointer break-all px-3 py-2 font-mono text-[12.5px] leading-snug ${
                i === active ? "bg-primary-soft" : "hover:bg-elevated"
              }`}
            >
              <HighlightedText text={h.path} ranges={h.ranges} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
