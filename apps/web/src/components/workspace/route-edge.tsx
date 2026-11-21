import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import type { Point } from "../../lib/graph/layout-input";
import { roundedPath } from "../../lib/graph/route";

/** Draws the polyline ELK routed for this edge; falls back to a curve if there is none. */
export function RouteEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps) {
  const points = (data as { points?: Point[] | null } | undefined)?.points;
  const path =
    points && points.length >= 2
      ? roundedPath(points)
      : getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })[0];
  return <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} interactionWidth={0} />;
}
