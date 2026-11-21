"use client";

import { useSearchParams } from "next/navigation";
import { Workspace } from "../workspace/workspace";
import { useReadyAnalysis } from "./provider";

export function WorkspacePage() {
  const { id, graph, meta } = useReadyAnalysis();
  const params = useSearchParams();
  return (
    <Workspace
      graph={graph}
      meta={meta}
      basePath={`/analyses/${id}`}
      initialNode={params.get("node")}
      initialCycle={params.get("cycle")}
    />
  );
}
