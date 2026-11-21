import type { Metadata } from "next";
import { DemoWorkspace } from "../../components/demo/workspace";

export const metadata: Metadata = {
  title: "Demo",
  description:
    "Explore real ARCHMAP analyzer output: dependency graph, evidence, cycles and impact.",
};

export default function DemoPage() {
  return <DemoWorkspace />;
}
