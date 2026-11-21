import type { Metadata } from "next";
import { DemoWorkspace } from "../../../components/workspace/demo-workspace";

export const metadata: Metadata = {
  title: "Demo",
  description:
    "Explore real ARCHMAP analyzer output: dependency graph, evidence, cycles and impact. No account needed.",
};

export default function DemoPage() {
  return <DemoWorkspace />;
}
