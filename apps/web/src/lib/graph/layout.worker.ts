import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkNode } from "elkjs/lib/elk-api";

// The DOM and WebWorker libs conflict in one tsconfig, so type the worker scope minimally.
interface WorkerScope {
  onmessage: ((ev: MessageEvent<{ id: number; graph: ElkNode }>) => void) | null;
  postMessage(message: unknown): void;
}
const scope = self as unknown as WorkerScope;
const elk = new ELK();

scope.onmessage = async (ev) => {
  const { id, graph } = ev.data;
  try {
    scope.postMessage({ id, ok: true, graph: await elk.layout(graph) });
  } catch (err) {
    scope.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
