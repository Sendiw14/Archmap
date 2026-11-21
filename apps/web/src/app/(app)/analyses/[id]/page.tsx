import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspacePage } from "../../../../components/analysis/workspace-page";

export const metadata: Metadata = { title: "Graph" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <WorkspacePage />
    </Suspense>
  );
}
