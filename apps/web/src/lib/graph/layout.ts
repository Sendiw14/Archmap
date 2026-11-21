import type { ElkNode } from "elkjs/lib/elk-api";
import { toLayoutData, type LayoutData } from "./layout-input";

/**
 * Runs ELK in a module Web Worker; if a worker cannot be created or fails, falls back
 * to the main thread. `engine` reports which one actually produced the layout.
 */
export interface LayoutResult extends LayoutData {
  engine: "worker" | "main-thread";
  ms: number;
}

type Reply = { id: number; ok: true; graph: ElkNode } | { id: number; ok: false; error: string };

let worker: Worker | null = null;
let workerBroken = false;
let seq = 0;
const pending = new Map<number, { resolve: (g: ElkNode) => void; reject: (e: Error) => void }>();

function failAll(message: string) {
  for (const p of pending.values()) p.reject(new Error(message));
  pending.clear();
}

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    const w = new Worker(new URL("./layout.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (ev: MessageEvent<Reply>) => {
      const p = pending.get(ev.data.id);
      if (!p) return;
      pending.delete(ev.data.id);
      if (ev.data.ok) p.resolve(ev.data.graph);
      else p.reject(new Error(ev.data.error));
    };
    w.onerror = () => {
      workerBroken = true;
      worker = null;
      failAll("Layout worker failed");
    };
    worker = w;
    return w;
  } catch {
    workerBroken = true;
    return null;
  }
}

async function onMainThread(graph: ElkNode): Promise<ElkNode> {
  const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
  return new ELK().layout(graph);
}

export async function computeLayout(graph: ElkNode): Promise<LayoutResult> {
  const t0 = performance.now();
  const w = getWorker();
  if (w) {
    try {
      const laid = await new Promise<ElkNode>((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject });
        w.postMessage({ id, graph });
      });
      return { ...toLayoutData(laid), engine: "worker", ms: performance.now() - t0 };
    } catch {
      // fall through to the main thread
    }
  }
  const laid = await onMainThread(graph);
  return { ...toLayoutData(laid), engine: "main-thread", ms: performance.now() - t0 };
}
