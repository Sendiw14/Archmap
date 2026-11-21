import type { Metadata } from "next";
import { AnalysisShell } from "../../../../components/analysis/shell";

// Temporary results: never index them (spec 8.4). Child pages inherit this.
export const metadata: Metadata = {
  title: "Analysis",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AnalysisLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AnalysisShell id={id}>{children}</AnalysisShell>;
}
