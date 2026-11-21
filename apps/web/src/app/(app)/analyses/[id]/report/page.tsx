import type { Metadata } from "next";
import { ReportPage } from "../../../../../components/analysis/report-page";

export const metadata: Metadata = { title: "Report" };

export default function Page() {
  return <ReportPage />;
}
