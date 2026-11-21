import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Box, Cpu, FileCode2 } from "lucide-react";
import type { ModuleFlowNode } from "../../lib/graph/flow";

const ICON = { file: FileCode2, external: Box, builtin: Cpu } as const;
const TAG = {
  selected: null,
  dependency: "imported",
  dependent: "imports",
  both: "mutual",
  member: "cycle",
} as const;

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i > 0 ? path.slice(0, i) : "";
}

export const ModuleNode = memo(function ModuleNode({ data }: NodeProps<ModuleFlowNode>) {
  const { node, role, match, dim } = data;
  const Icon = ICON[node.kind];
  const sub =
    node.kind === "file"
      ? dirOf(node.path) || "repository root"
      : node.kind === "external"
        ? "external package"
        : "Node.js built-in";
  const tag = match && !role ? "match" : role ? TAG[role] : null;
  return (
    <div
      className="am-node"
      data-kind={node.kind}
      data-role={role ?? undefined}
      data-match={match || undefined}
      data-dim={dim || undefined}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <Icon size={18} aria-hidden="true" className="flex-none text-muted" />
      <div className="min-w-0 flex-1">
        <div className="am-node__name">{node.displayName}</div>
        <div className="am-node__sub">{sub}</div>
      </div>
      {tag && <span className="am-node__tag">{tag}</span>}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
});
